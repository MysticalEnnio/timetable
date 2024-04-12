import { WebUntisQR } from 'webuntis';
import { URL } from 'url';
import { authenticator as Authenticator } from 'otplib';

// The result of the scanned QR Code
const QRCodeData =
    'untis://setschool?url=perseus.webuntis.com&school=Gymnasium im Schloss&user=2020052616293039&key=ZFRROUY2VQV2U5EQ&schoolNumber=2278200';
console.log('Generating QR Code for WebUntis...');
const untis = new WebUntisQR(QRCodeData, 'custom-identity', Authenticator, URL);
console.log('QR Code generated');
console.log('Logging in...');
await untis.login();
console.log('Logged In');

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate());
const timetable = await untis.getOwnTimetableFor(tomorrow);

console.log(JSON.stringify(timetable, null, 2));
