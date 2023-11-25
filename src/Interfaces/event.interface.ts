export interface IEvent {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
}

export interface IEventResponse extends IEvent {
  formattedStartDate: string;
  formattedEndDate: string;
  dayOfWeek: string;
}

export interface IFreeSlot {
  start: string;
  end: string;
  day: string;
}

export interface IEventCreationResponse {
  id: string;
}
