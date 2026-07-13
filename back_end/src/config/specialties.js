// Mirrors src/data/specialties.js on the frontend. Only the fields the
// reply generator needs are kept here.
export const SPECIALTIES = [
  { id: 'pediatrics', name: 'Tư vấn sức khỏe' },
  { id: 'general', name: 'Đa khoa' },
  { id: 'dermatology', name: 'Da liễu' },
  { id: 'nutrition', name: 'Dinh dưỡng' },
]

export function getSpecialty(id) {
  return SPECIALTIES.find((s) => s.id === id) ?? SPECIALTIES[0]
}
