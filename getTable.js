import { WebUntisQR } from 'webuntis';
import { URL } from 'url';
import { authenticator as Authenticator } from 'otplib';

// The result of the scanned QR Code
const QRCodeData =
    'untis://setschool?url=perseus.webuntis.com&school=Gymnasium im Schloss&user=2019011610485630&key=DHA6CUFNXKEC5TN6&schoolNumber=2278200';

console.log('Generating QR Code for WebUntis...');
const untis = new WebUntisQR(QRCodeData, 'custom-identity', Authenticator, URL);
console.log('QR Code generated');
console.log('Logging in...');
await untis.login();
console.log('Logged In');

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const timetable = await untis.getOwnTimetableFor(tomorrow);

console.log(JSON.stringify(timetable, null, 2));
