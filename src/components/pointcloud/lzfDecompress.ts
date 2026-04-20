/**
 * LZF 解压函数（用于 binary_compressed PCD 文件）
 */
export function decompressLZF(inData: Uint8Array, outLength: number): Uint8Array {
  const outData = new Uint8Array(outLength);
  let inPtr = 0;
  let outPtr = 0;
  
  while (inPtr < inData.length && outPtr < outLength) {
    const ctrl = inData[inPtr++];
    
    if (ctrl < 32) {
      // 字面量块
      for (let i = 0; i <= ctrl; i++) {
        outData[outPtr++] = inData[inPtr++];
      }
    } else {
      // 回溯引用
      const length = ctrl >> 5;
      const offset = ((ctrl & 0x1f) << 8) + inData[inPtr++];
      
      for (let i = 0; i <= length; i++) {
        outData[outPtr] = outData[outPtr - offset - 1];
        outPtr++;
      }
    }
  }
  
  return outData;
}
