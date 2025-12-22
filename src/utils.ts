export function unique<T>(arr: T[]): T[] {
  const result: T[] = [];
  outer: for (let i = 0; i < arr.length; i++) {
    for (let x = 0; x < result.length; x++) {
      if (JSON.stringify(result[x]) === JSON.stringify(arr[i])) {
        continue outer;
      }
    }
    result.push(arr[i]);
  }
  return result;
}

