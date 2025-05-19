
// Add the multiline property to the SubTask interface
export interface SubTask {
  id: string;
  title: string;
  status: SubTaskStatus;
  options: string[];
  description: string;
  selectedOption?: string;
  textInput?: boolean;
  textValue?: string;
  multiline?: boolean;
  placeholder?: string;
}

export type SubTaskStatus = 'pending' | 'inProgress' | 'completed' | 'na';
