/** Public hosts that are not the live pulseone.com cutover set this to "false". */
export function indexingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ROBOTS_INDEX !== "false";
}
