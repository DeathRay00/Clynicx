const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /reports
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    let result;

    if (user.role === 'patient') {
      result = await pool.query(
        `SELECT * FROM medical_reports WHERE patient_id = $1 ORDER BY upload_date DESC`,
        [user.id]
      );
    } else if (user.role === 'doctor') {
      result = await pool.query(
        `SELECT * FROM medical_reports WHERE doctor_id = $1 ORDER BY upload_date DESC`,
        [user.id]
      );
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const reports = result.rows.map(mapReport);
    return res.json({
      reports,
      totalCount: reports.length,
      analyzedCount: reports.filter(r => r.aiAnalysis).length,
      pendingCount: reports.filter(r => !r.aiAnalysis).length,
    });
  } catch (err) {
    console.error('Fetch reports error:', err);
    return res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// GET /reports/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const result = await pool.query(`SELECT * FROM medical_reports WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const r = result.rows[0];
    if (r.patient_id !== user.id && r.doctor_id !== user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    return res.json(mapReport(r));
  } catch (err) {
    console.error('Fetch report error:', err);
    return res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// POST /reports - upload a report (patient only)
router.post('/', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== 'patient') {
      return res.status(403).json({ error: 'Only patients can upload reports' });
    }

    const { doctorId, reportType, labName, cost, fileUrl, aiAnalysis } = req.body;

    // Get doctor name if provided
    let doctorName = null;
    if (doctorId) {
      const docRes = await pool.query(`SELECT full_name FROM users WHERE id = $1`, [doctorId]);
      if (docRes.rows.length > 0) doctorName = docRes.rows[0].full_name;
    }

    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO medical_reports (
        id, patient_id, doctor_id, patient_name, doctor_name,
        report_type, lab_name, cost, file_url, ai_analysis
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        id, user.id, doctorId || null,
        user.full_name, doctorName,
        reportType || null, labName || null, cost || null,
        fileUrl || null,
        aiAnalysis ? JSON.stringify(aiAnalysis) : null,
      ]
    );

    // Log activity for doctor if provided
    if (doctorId) {
      await pool.query(
        `INSERT INTO doctor_activity (id, doctor_id, patient_id, patient_name, activity_type, report_type)
         VALUES ($1,$2,$3,$4,'report_upload',$5)`,
        [uuidv4(), doctorId, user.id, user.full_name, reportType]
      );
    }

    return res.status(201).json({
      success: true,
      report: mapReport(result.rows[0]),
    });
  } catch (err) {
    console.error('Upload report error:', err);
    return res.status(500).json({ error: 'Failed to upload report' });
  }
});

// DELETE /reports/:id - delete a report (patient only)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const check = await pool.query(
      `SELECT id FROM medical_reports WHERE id = $1 AND patient_id = $2`,
      [id, user.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found or unauthorized' });
    }

    await pool.query(`DELETE FROM medical_reports WHERE id = $1`, [id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete report error:', err);
    return res.status(500).json({ error: 'Failed to delete report' });
  }
});

// PUT /reports/:id - update AI analysis
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const { aiAnalysis } = req.body;

    const result = await pool.query(
      `UPDATE medical_reports SET ai_analysis = $1 WHERE id = $2 AND patient_id = $3 RETURNING *`,
      [JSON.stringify(aiAnalysis), id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    return res.json({ success: true, report: mapReport(result.rows[0]) });
  } catch (err) {
    console.error('Update report error:', err);
    return res.status(500).json({ error: 'Failed to update report' });
  }
});

function mapReport(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    patientName: row.patient_name,
    doctorName: row.doctor_name,
    reportType: row.report_type,
    labName: row.lab_name,
    cost: row.cost,
    fileUrl: row.file_url,
    aiAnalysis: row.ai_analysis,
    uploadDate: row.upload_date,
    createdAt: row.created_at,
  };
}

module.exports = router;
