export const HOUR_HEIGHT = 58;

export function layoutDayEvents(events) {
  const sorted = events
    .map((event) => ({ ...event }))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const placed = [];
  let cluster = [];
  let clusterEnd = -1;

  function flush() {
    if (!cluster.length) return;
    const columnEnds = [];
    for (const item of cluster) {
      let column = columnEnds.findIndex((end) => end <= item.startMin);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(item.endMin);
      } else {
        columnEnds[column] = item.endMin;
      }
      item.col = column;
    }
    const cols = Math.max(1, columnEnds.length);
    for (const item of cluster) item.cols = cols;
    placed.push(...cluster);
    cluster = [];
    clusterEnd = -1;
  }

  for (const event of sorted) {
    if (cluster.length && event.startMin >= clusterEnd) flush();
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, event.endMin);
  }
  flush();
  return placed;
}
