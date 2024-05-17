import { WebUntisQR } from 'webuntis';
import { URL } from 'url';
import { authenticator as Authenticator } from 'otplib';
import waw from 'whatsapp-web.js';
const { Client, LocalAuth } = waw;
import qrcode from 'qrcode-terminal';
import cron from 'node-cron';
import fs from 'fs';
import minimist from 'minimist';
const argv = minimist(process.argv.slice(2));

// Create a new client instance
const client = new Client({
    authStrategy: new LocalAuth(),
    //no sandbox puppeteer
    puppeteer: {
        args: ['--no-sandbox'],
    },
    webVersionCache: {
        type: 'remote',
        remotePath:
            'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
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

function getDuplicates(array, key) {
    const duplicates = [];
    const seen = new Map();

    for (const obj of array) {
        const value = obj[key];
        const existing = seen.get(value);
        if (existing) {
            existing.push(obj);
        } else {
            seen.set(value, [obj]);
        }
    }

    // Filter out entries with only one element (not duplicates)
    for (const [key, value] of seen.entries()) {
        if (value.length > 1) {
            duplicates.push(value);
        }
    }
    return duplicates;
}

function removeMatchingItems(sourceArray, itemsToRemove) {
    const filteredArray = sourceArray.filter(
        (item) => !itemsToRemove.some((removeItem) => removeItem === item)
    );
    return filteredArray;
}

let users = [];

async function messageUserTT(dateShift, scheduled = false, user) {
    if (scheduled) {
        console.log('Running scheduled task...');
    }
    console.log('Starting to get timetable...');
    async function getTT(timetable) {
        const dateShiftName = dateShiftNamen.get(dateShift);
        let ausfallNum = 0;

        //check for do8ble bookings by checking if they start at the same time. If they do, remove them both from the array and pass them into an extra function
        let duplicates = getDuplicates(timetable, 'startTime').flat();
        timetable = removeMatchingItems(timetable, duplicates);

        //filter out the cancelled
        duplicates.filter((activity) => {
            if (activity.code == 'cancelled') {
                ausfallNum++;
                //search for replacement(activity.code = irregular)
                let replacement = duplicates.find(
                    (activity2) =>
                        activity2.code == 'irregular' &&
                        activity2.startTime == activity.startTime
                );
                if (replacement) {
                    let messageString = `${dateShiftName} ${
                        activity.su[0].longname
                    } Vertretung in der ${
                        sjTimes.get(activity.startTime).num
                    }. Stunde(${
                        sjTimes.get(activity.startTime).string
                    }) von Frau/Herr ${replacement.te[0].longname} in ${
                        replacement.ro[0].longname
                    }(${replacement.ro[0].name})`;
                    client.sendMessage(user.user, messageString);
                    console.log(messageString);
                } else {
                    let messageString = `${dateShiftName} ${
                        activity.su[0].longname
                    } Ausfall in der ${
                        sjTimes.get(activity.startTime).num
                    }. Stunde`;
                    client.sendMessage(user.user, messageString);
                    console.log(messageString);
                }
            }
        });

        timetable.map(async (activity) => {
            if (activity.activityType === 'Unterricht') {
                if (activity.code == 'cancelled') {
                    ausfallNum++;
                    let messageString = `${dateShiftName} ${
                        activity.su[0].longname
                    } Ausfall in der ${
                        sjTimes.get(activity.startTime).num
                    }. Stunde`;
                    client.sendMessage(user.user, messageString);
                    console.log(messageString);
                }
                if (activity.te[0].orgid) {
                    ausfallNum++;
                    let messageString = `${dateShiftName} ${
                        activity.su[0].longname
                    } Vertretung in der ${
                        sjTimes.get(activity.startTime).num
                    }. Stunde(${
                        sjTimes.get(activity.startTime).string
                    }) von Frau/Herr ${activity.te[0].longname} in ${
                        activity.ro[0].longname
                    }(${activity.ro[0].name})`;
                    client.sendMessage(user.user, messageString);
                    console.log(messageString);
                }
                if (activity.ro[0].orgid) {
                    ausfallNum++;
                    let messageString = `${dateShiftName} ${
                        activity.su[0].longname
                    } Raumwechsel in der ${
                        sjTimes.get(activity.startTime).num
                    }. Stunde(${
                        sjTimes.get(activity.startTime).string
                    }) nach Raum ${activity.ro[0].name}(${
                        activity.ro[0].longname
                    }) {Vorher Raum ${activity.ro[0].orgname}}`;
                    client.sendMessage(user.user, messageString);
                    console.log(messageString);
                }
            }
        });
        if (ausfallNum == 0) {
            console.log(`${dateShiftName} kein Ausfall`);
            client.sendMessage(user.user, `${dateShiftName} kein Ausfall`);
        }
    }
    if (user != undefined) {
        sendTT(user);
    } else {
        users.map((e) => sendTT(e));
    }
}

client.on('ready', () => {
    console.log('Client is ready!');
    console.log('argumets: ' + JSON.stringify(argv));
    let cronStr = `* * * * *`;
    if (argv.t == true) {
        console.log('Specific time set');
        cronStr = `${argv.m ?? 0} ${argv.h ?? 18} * * *`;
    } else {
        console.log('Default time set');
        cronStr = `0 18 * * *`;
    }
    if (!cron.validate(cronStr)) {
        console.log('Invalid cron expression');
        return;
    }
    cron.schedule(
        cronStr,
        () => {
            try {
                messageUserTT(1, 1);
            } catch (e) {
                console.log(e);
            }
        },
        {
            scheduled: true,
            timezone: 'Europe/Berlin',
        }
    );
    if (argv.test == true) {
        console.log('Test mode enabled');
        messageUserTT(0);
        messageUserTT(1);
        messageUserTT(2);
    }
});
client.on('qr', (qr) => {
    console.log('Wa client is ready to scan QR Code!');
    qrcode.generate(qr, { small: true });
});
client.on('message_create', (message) => {
    message.body = message.body.toLowerCase();

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

            let qrData = message.body
                .split(' ')
                .slice(2, message.body.length)
                .join(' ');
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
    } else if (message.body.trim() == 'untis') {
        console.log('Getting timetable...');
        let dateShift = 1;
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
});
console.log('Initializing wa client...');
client.initialize();
users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
console.log('Number of users: ' + users.length);
