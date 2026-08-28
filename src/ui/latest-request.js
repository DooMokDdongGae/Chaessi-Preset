export function createLatestRequestGuard() {
  let sequence = 0;
  return {
    begin() {
      sequence += 1;
      return sequence;
    },
    cancel() {
      sequence += 1;
    },
    isCurrent(token) {
      return token === sequence;
    },
  };
}
