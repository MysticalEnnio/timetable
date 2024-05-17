import { WebUntisQR } from 'webuntis';
import { URL } from 'url';
import { authenticator as Authenticator } from 'otplib';
import fs from 'fs';

// The result of the scanned QR Code
const QRCodeData =
    'untis://setschool?url=perseus.webuntis.com&school=Gymnasium im Schloss&user=2020052616293039&key=ZFRROUY2VQV2U5EQ&schoolNumber=2278200';
const dateShift = 0;
console.log('Generating QR Code for WebUntis...');
const untis = new WebUntisQR(QRCodeData, 'custom-identity', Authenticator, URL);
console.log('QR Code generated');
console.log('Logging in...');
await untis.login();
console.log('Logged In');

const today = new Date();
const modifiedDate = new Date(today);
modifiedDate.setDate(modifiedDate.getDate() + dateShift);
const timetable = await untis.getOwnTimetableFor(modifiedDate);

fs.writeFileSync(
    `./tableData/${modifiedDate.toDateString()}.json`,
    JSON.stringify(timetable, null, 2)
);

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
                console.log(
                    `${dateShiftName} ${
                        activity.su[0].longname
                    } Vertretung in der ${
                        sjTimes.get(activity.startTime).num
                    }. Stunde(${
                        sjTimes.get(activity.startTime).string
                    }) von Frau/Herr ${replacement.te[0].longname} in ${
                        replacement.ro[0].longname
                    }(${replacement.ro[0].name})`
                );
            } else {
                console.log(
                    `${dateShiftName} ${
                        activity.su[0].longname
                    } Ausfall in der ${
                        sjTimes.get(activity.startTime).num
                    }. Stunde`
                );
            }
        }
    });

    timetable.map(async (activity) => {
        if (activity.activityType === 'Unterricht') {
            if (activity.code == 'cancelled') {
                ausfallNum++;
                console.log(
                    `${dateShiftName} ${
                        activity.su[0].longname
                    } Ausfall in der ${
                        sjTimes.get(activity.startTime).num
                    }. Stunde`
                );
            }
            if (activity.te[0].orgid) {
                ausfallNum++;
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
            if (activity.ro[0].orgid) {
                ausfallNum++;
                console.log(
                    `${dateShiftName} ${
                        activity.su[0].longname
                    } Raumwechsel in der ${
                        sjTimes.get(activity.startTime).num
                    }. Stunde(${
                        sjTimes.get(activity.startTime).string
                    }) nach Raum ${activity.ro[0].name}(${
                        activity.ro[0].longname
                    }) {Vorher Raum ${activity.ro[0].orgname}}`
                );
            }
        }
    });
    if (ausfallNum == 0) {
        console.log(`${dateShiftName} kein Ausfall`);
    }
}

getTT(timetable);
