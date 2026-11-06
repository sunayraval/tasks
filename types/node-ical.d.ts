declare module "node-ical" {
  export interface CalendarComponent {
    type: string;
    summary?: string;
    description?: string;
    start?: Date;
    end?: Date;
    uid?: string;
    [key: string]: unknown;
  }

  export const async: {
    fromURL(url: string): Promise<Record<string, CalendarComponent>>;
  };

  export const sync: {
    parseICS(icsData: string): Record<string, CalendarComponent>;
  };

  const ical: {
    async: typeof async;
    sync: typeof sync;
  };

  export default ical;
}

