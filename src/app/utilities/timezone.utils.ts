// utils/timezone.utils.ts

import moment from "moment-timezone";

export class TimezoneUtils {
    /**
     * Convert local time to UTC
     * @param time - Time in HH:mm format (e.g., "09:00")
     * @param timezone - Timezone string (e.g., "America/Guyana")
     * @returns UTC time in HH:mm format
     */
    static convertToUTC(time: string, timezone: string): string {
        const utcTime = moment.tz(time, "HH:mm", timezone).utc().format("HH:mm");
        return utcTime;
    }

    /**
     * Convert UTC time to local timezone
     * @param utcTime - UTC time in HH:mm format
     * @param timezone - Target timezone string
     * @returns Local time in HH:mm format
     */
    static convertFromUTC(utcTime: string, timezone: string): string {
        const localTime = moment.utc(utcTime, "HH:mm").tz(timezone).format("HH:mm");
        return localTime;
    }

    /**
     * Check if time ranges overlap
     * @param start1 - First range start time (UTC HH:mm)
     * @param end1 - First range end time (UTC HH:mm)
     * @param start2 - Second range start time (UTC HH:mm)
     * @param end2 - Second range end time (UTC HH:mm)
     * @returns True if times overlap
     */
    static isTimeOverlap(
        start1: string,
        end1: string,
        start2: string,
        end2: string
    ): boolean {
        const start1Minutes = this.timeToMinutes(start1);
        const end1Minutes = this.timeToMinutes(end1);
        const start2Minutes = this.timeToMinutes(start2);
        const end2Minutes = this.timeToMinutes(end2);

        return start1Minutes < end2Minutes && end1Minutes > start2Minutes;
    }

    /**
     * Convert HH:mm to minutes since midnight
     */
    private static timeToMinutes(time: string): number {
        const [hours, minutes] = time.split(":").map(Number);
        return hours * 60 + minutes;
    }

    /**
     * Validate timezone string
     */
    static isValidTimezone(timezone: string): boolean {
        return moment.tz.zone(timezone) !== null;
    }

    /**
     * Get current time in specific timezone
     */
    static getCurrentTime(timezone: string): string {
        return moment.tz(timezone).format("HH:mm");
    }
}