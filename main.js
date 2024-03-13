import { WebUntisQR } from 'webuntis';
import { URL } from 'url';
import { authenticator as Authenticator } from 'otplib';
import waw from 'whatsapp-web.js';
const { Client, LocalAuth } = waw;
import qrcode from 'qrcode-terminal';
import cron from 'node-cron';
import fs from 'fs';

// Create a new client instance
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: ['--no-sandbox'],
});

const sjTimes = new Map([
    [740, { num: 1, start: 740, end: 825, string: '07:40 - 08:25' }],
    [830, { num: 2, start: 830, end: 915, string: '08:30 - 09:15' }],
    [935, { num: 3, start: 935, end: 1020, string: '09:35 - 10:20' }],
    [1025, { num: 4, start: 1025, end: 1110, string: '10:25 - 11:10' }],
    [1130, { num: 5, start: 1130, end: 1215, string: '11:30 - 12:15' }],
    [1220, { num: 6, start: 1220, end: 1305, string: '12:20 - 13:05' }],
    [1350, { num: 7, start: 1350, end: 1435, string: '13:50 - 14:35' }],
    [1435, { num: 8, start: 1435, end: 1520, string: '14:35 - 15:20' }],
]);

const dateShiftNamen = new Map([
    [-2, 'Vorgestern'],
    [-1, 'Gestern'],
    [0, 'Heute'],
    [1, 'Morgen'],
    [2, 'Übermorgen'],
    [3, 'In 3 Tagen'],
    [4, 'In 4 Tagen'],
    [5, 'In 5 Tagen'],
    [6, 'In 6 Tagen'],
    [7, 'In einer Woche'],
]);

let users = [];

async function messageUserTT(dateShift, scheduled = false, user) {
    if (scheduled) {
        console.log('Running scheduled task...');
    }
    console.log('Starting to get timetable...');
    async function sendTT(user) {
        console.log('Getting timetable for ' + user.user);
        console.log('QR Code: ' + user.qr);
        // The result of the scanned QR Code
        const QRCodeData = user.qr;

        console.log('Generating QR Code for WebUntis...');
        const untis = new WebUntisQR(
            QRCodeData,
            'custom-identity',
            Authenticator,
            URL
        );
        console.log('QR Code generated');
        console.log('Logging in...');
        await untis.login();

        console.log('Logged In');

        console.log('Getting timetable...');
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + dateShift);
        const timetable = await untis.getOwnTimetableFor(tomorrow);
        console.log('Timetable fetched');

        const dateShiftName = dateShiftNamen.get(dateShift);

        let ausfallNum = 0;
        timetable.map(async (activity) => {
            //console.log(activity);

            if (activity.activityType === 'Unterricht') {
                if (activity.te[0].name == '---') {
                    ausfallNum++;
                    client.sendMessage(
                        user.user,
                        `${dateShiftName} ${activity.su[0].longname} Ausfall`
                    );
                    console.log(
                        `${dateShiftName} ${activity.su[0].longname} Ausfall`
                    );
                }
                if (activity.te[0].orgid) {
                    ausfallNum++;
                    client.sendMessage(
                        user.user,
                        `${dateShiftName} ${
                            activity.su[0].longname
                        } Vertretung in der ${
                            sjTimes.get(activity.startTime).num
                        }. Stunde(${
                            sjTimes.get(activity.startTime).string
                        }) von Frau/Herr ${activity.te[0].longname} in ${
                            activity.ro[0].longname
                        }(${activity.ro[0].name})`
                    );

                    console.log(
                        `${dateShiftName} ${
                            activity.su[0].longname
                        } Vertretung in der ${
                            sjTimes.get(activity.startTime).num
                        }. Stunde(${
                            sjTimes.get(activity.startTime).string
                        }) von Frau/Herr ${activity.te[0].longname} in ${
                            activity.ro[0].longname
                        }(${activity.ro[0].name})`
                    );
                }
            }
        });
        if (ausfallNum == 0) {
            client.sendMessage(user.user, `${dateShiftName} kein Ausfall`);
            console.log(`${dateShiftName} kein Ausfall`);
        }
    }
    if (user != undefined) {
        sendTT(user);
    } else {
        users.map(sendTT(e));
    }
}

client.on('ready', () => {
    console.log('Client is ready!');
    cron.schedule(
        '0 18 * * *',
        () => {
            try {
                messageUsersTT(1, 1);
            } catch (e) {
                console.log(e);
            }
        },
        {
            scheduled: true,
            timezone: 'Europe/Berlin',
        }
    );
});
client.on('qr', (qr) => {
    console.log('Wa client is ready to scan QR Code!');
    qrcode.generate(qr, { small: true });
});
client.on('message_create', (message) => {
    console.log(`Received message from ${message.from}: ${message.body}`);
    if (message.body.startsWith('!wu')) {
        let command = message.body.split(' ')[1];
        console.log('Command: ' + command);
        if (command == 'qr') {
            if (!message.body.split(' ')[2].startsWith('untis://setschool')) {
                console.log('Invalid QR Code');
                client.sendMessage(
                    message.from,
                    'Der QR Code ist ungültig. Bitte versuche es erneut.'
                );
                return;
            }
            console.log('Adding user');

            let qrData = message.body.split(' ')[2];
            console.log('QR Data: ' + qrData);
            if (
                users.find((user) => user.user === message.from) !== undefined
            ) {
                console.log('User already exists');
                client.sendMessage(
                    message.from,
                    'Du bist bereits hinzugefügt.'
                );
                return;
            }
            console.log('User does not exist');
            users.push({
                user: message.from,
                qr: qrData,
            });
            fs.writeFileSync('users.json', JSON.stringify(users), 'utf8');
            console.log('User added');
            // send back "pong" to the chat the message was sent in
            client.sendMessage(
                message.from,
                'Du wurdest erfolgreich hinzugefügt.'
            );
            messageUserTT(0);
            messageUserTT(1);
            messageUserTT(2);
        } else if (command == 'tt') {
            console.log('Getting timetable...');
            let dateShift = parseInt(message.body.split(' ')[2] ?? '1');
            console.log('Date Shift: ' + dateShift);
            let user = users.find((user) => user.user === message.from);
            console.log('User: ' + JSON.stringify(user));
            if (user == undefined) {
                console.log('User does not exist');
                client.sendMessage(
                    message.from,
                    'Du hast noch keinen QR Code hinzugefügt. Bitte füge einen hinzu.'
                );
                return;
            }
            messageUserTT(dateShift, 0, user);
        }
    }
});
console.log('Initializing wa client...');
client.initialize();
users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
console.log('Number of users: ' + users.length);
