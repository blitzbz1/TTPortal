import { useLocalSearchParams } from 'expo-router';
import { EquipmentModelScreen } from '@/src/screens';
import type { EquipmentCategory } from '@/src/types/database';

export default function GearModelRoute() {
  const { category, manufacturerId, manufacturer, model } = useLocalSearchParams<{
    category: EquipmentCategory;
    manufacturerId: string;
    manufacturer?: string;
    model: string;
  }>();
  return (
    <EquipmentModelScreen
      category={(category === 'rubber' ? 'rubber' : 'blade') as EquipmentCategory}
      manufacturerId={manufacturerId ?? ''}
      manufacturer={manufacturer}
      model={model ?? ''}
    />
  );
}
