import { Socket } from 'net';

/**
 * Analyse antivirus via clamd (protocole INSTREAM). Renvoie null si le fichier est sain, sinon le
 * nom de la signature détectée. Lève une erreur si clamd ne répond pas correctement.
 */
export function clamdScan(host: string, port: number, data: Buffer, timeoutMs = 30_000): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    let reply = '';
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error('clamd : délai dépassé')));
    socket.on('error', reject);
    socket.on('data', (chunk) => (reply += chunk.toString('utf8')));
    socket.on('close', () => {
      const text = reply.replace(/\0/g, '').trim();
      if (text.endsWith('OK')) return resolve(null);
      const found = /:\s*(.+)\s+FOUND$/.exec(text);
      if (found) return resolve(found[1]);
      reject(new Error(`clamd : réponse inattendue « ${text} »`));
    });
    socket.connect(port, host, () => {
      socket.write('zINSTREAM\0');
      const chunkSize = 64 * 1024;
      for (let offset = 0; offset < data.length; offset += chunkSize) {
        const chunk = data.subarray(offset, offset + chunkSize);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length, 0);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
  });
}
