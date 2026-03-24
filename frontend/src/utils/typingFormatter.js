export const formatTypingSummary = (participants = []) => {
  const names = participants
    .map((participant) => participant?.name?.trim())
    .filter(Boolean);
  if (!names.length || names.length === 1) return "typing ...";
  if (names.length === 2) return `${names[0]} & ${names[1]} are typing ...`;
  return `${names[0]} + ${names.length - 1} others are typing ...`;
};

export default formatTypingSummary;
