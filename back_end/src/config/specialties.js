export const SPECIALTIES = [
  { id: 'pediatrics', name: { vi: 'Tư vấn sức khỏe', en: 'Health Consultation' } },
  { id: 'general', name: { vi: 'Đa khoa', en: 'General Medicine' } },
  { id: 'dermatology', name: { vi: 'Da liễu', en: 'Dermatology' } },
  { id: 'nutrition', name: { vi: 'Dinh dưỡng', en: 'Nutrition' } },
]

export function getSpecialty(id) {
  return SPECIALTIES.find((s) => s.id === id) ?? SPECIALTIES[0]
}
