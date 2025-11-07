/**
 * Common formatting utilities
 */

export const formatFrequency = (frequency: any): string => {
  // If frequency is already a string, return it
  if (typeof frequency === 'string') {
    return frequency;
  }
  
  // If frequency is an object with meal timings
  if (typeof frequency === 'object' && frequency !== null) {
    const parts: string[] = [];
    
    if (frequency.breakfast?.before || frequency.breakfast?.after) {
      const timing = [];
      if (frequency.breakfast.before) timing.push('Before');
      if (frequency.breakfast.after) timing.push('After');
      parts.push(`Breakfast (${timing.join(' & ')})`);
    }
    
    if (frequency.lunch?.before || frequency.lunch?.after) {
      const timing = [];
      if (frequency.lunch.before) timing.push('Before');
      if (frequency.lunch.after) timing.push('After');
      parts.push(`Lunch (${timing.join(' & ')})`);
    }
    
    if (frequency.dinner?.before || frequency.dinner?.after) {
      const timing = [];
      if (frequency.dinner.before) timing.push('Before');
      if (frequency.dinner.after) timing.push('After');
      parts.push(`Dinner (${timing.join(' & ')})`);
    }
    
    return parts.length > 0 ? parts.join(', ') : 'As directed';
  }
  
  return 'As directed';
};

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
};

export const calculateAge = (dateOfBirth: string) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};
