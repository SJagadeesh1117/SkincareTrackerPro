export type RoutineItem = {
  id: string;
  name: string;
  description: string;
  notes?: string;
  completed: boolean;
  timeOfDay: 'morning' | 'evening' | 'weekly';
};
