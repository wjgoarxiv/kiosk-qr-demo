export function formatKrw(amount) {
  return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}원`;
}

// Minutes and seconds ("01:00"), so a 60-second limit never reads as "00:60".
export function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
