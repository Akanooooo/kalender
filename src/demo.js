import { addDaysYmd, berlinStamp } from './dates.js';

function timed(anchor, offset, start, end, extra) {
  const startDate = addDaysYmd(anchor, offset);
  let endDate = startDate;
  if (end <= start) endDate = addDaysYmd(startDate, 1);
  const startIso = berlinStamp(startDate, start);
  const endIso = berlinStamp(endDate, end);
  if (new Date(endIso) <= new Date(startIso)) {
    throw new Error(`Ungültige Demospanne: ${extra.key}`);
  }
  return {
    id: `demo-sample-${extra.key}`,
    title: extra.title,
    location: extra.location || '',
    notes: extra.notes || '',
    allDay: false,
    startDate,
    endDate,
    start: startIso,
    end: endIso,
    colorId: extra.colorId || null,
    htmlLink: null,
    updated: null,
  };
}

function allDay(anchor, offset, days, extra) {
  const startDate = addDaysYmd(anchor, offset);
  const endDate = addDaysYmd(startDate, days - 1);
  return {
    id: `demo-sample-${extra.key}`,
    title: extra.title,
    location: extra.location || '',
    notes: extra.notes || '',
    allDay: true,
    startDate,
    endDate,
    start: null,
    end: null,
    colorId: extra.colorId || null,
    htmlLink: null,
    updated: null,
  };
}

export function buildDemoEvents(anchor) {
  const events = [
    allDay(anchor, 0, 1, {
      key: 'paket',
      title: 'Paket erwartet',
      notes: 'Hermes, voraussichtlich bis 18 Uhr.',
      colorId: '6',
    }),
    timed(anchor, 0, '08:00', '08:45', {
      key: 'lauf',
      title: 'Morgenlauf im Treptower Park',
      location: 'Treptower Park',
      notes: 'Leichtes Tempo, danach Kaffee.',
      colorId: '2',
    }),
    timed(anchor, 0, '10:00', '11:00', {
      key: 'zahna',
      title: 'Zahnarzt',
      location: 'Praxis Dr. Bürger, Torstraße 12, Berlin',
      notes: 'Kontrolltermin. Versichertenkarte mitnehmen.\nhttps://example.com',
      colorId: '4',
    }),
    timed(anchor, 0, '13:00', '14:15', {
      key: 'mittag',
      title: 'Mittagessen mit Lea',
      location: 'Café Einstein, Unter den Linden',
      notes: 'Tisch ist auf den Namen Lea reserviert.',
      colorId: '5',
    }),
    timed(anchor, 0, '16:00', '17:00', {
      key: 'anruf',
      title: 'Anruf Versicherung',
      notes: 'Vertragsnummer liegt auf dem Schreibtisch.',
      colorId: '8',
    }),
    timed(anchor, 0, '16:15', '16:45', {
      key: 'annehmen',
      title: 'Paket annehmen',
      location: 'Zuhause',
      colorId: '11',
    }),
    timed(anchor, 0, '19:30', '21:00', {
      key: 'essen',
      title: 'Abendessen',
      location: 'Lavanderia Vecchia, Neukölln',
      colorId: '3',
    }),
    timed(anchor, 1, '09:30', '10:15', {
      key: 'besprechung',
      title: 'Projektbesprechung',
      location: 'Videocall',
      notes: 'Tagesordnung steht in der Mail.',
      colorId: '7',
    }),
    timed(anchor, 1, '15:00', '16:30', {
      key: 'fokus',
      title: 'Fokuszeit Konzept',
      location: 'Zuhause',
      colorId: '9',
    }),
    timed(anchor, 2, '18:30', '21:00', {
      key: 'kino',
      title: 'Kino',
      location: 'Yorck Kino, Berlin',
      notes: 'Karten sind auf dem Handy.',
      colorId: '3',
    }),
    timed(anchor, 3, '12:15', '13:15', {
      key: 'yoga',
      title: 'Yoga',
      location: 'Studio Kreuzberg',
      colorId: '2',
    }),
    timed(anchor, 4, '11:00', '12:30', {
      key: 'markt',
      title: 'Wochenmarkt',
      location: 'Maybachufer',
      colorId: '6',
    }),
    allDay(anchor, 5, 1, {
      key: 'geburtstag',
      title: 'Geburtstag Mama',
      notes: 'Anrufen. Blumen sind bestellt.',
      colorId: '4',
    }),
    timed(anchor, 6, '10:30', '12:00', {
      key: 'brunch',
      title: 'Brunch',
      location: 'Roamers, Neukölln',
      colorId: '5',
    }),
    timed(anchor, 8, '09:00', '09:30', {
      key: 'standup',
      title: 'Standup',
      location: 'Videocall',
      colorId: '7',
    }),
    allDay(anchor, 9, 1, {
      key: 'homeoffice',
      title: 'Homeoffice',
      colorId: '9',
    }),
    timed(anchor, 10, '19:00', '22:00', {
      key: 'konzert',
      title: 'Konzert',
      location: 'Columbiahalle',
      notes: 'Einlass 19 Uhr, Beginn 20 Uhr.',
      colorId: '3',
    }),
    allDay(anchor, 12, 2, {
      key: 'trip',
      title: 'Wochenendtrip Hamburg',
      notes: 'Zugtickets sind im Wallet.',
      colorId: '7',
    }),
    timed(anchor, 16, '08:30', '09:15', {
      key: 'blut',
      title: 'Blutspende',
      location: 'DRK, Mehringdamm',
      notes: 'Ausweis mitnehmen und vorher etwas essen.',
      colorId: '11',
    }),
    timed(anchor, 18, '18:00', '19:00', {
      key: 'spaziergang',
      title: 'Abendspaziergang',
      location: 'Tempelhofer Feld',
      colorId: '10',
    }),
    timed(anchor, -1, '19:00', '20:00', {
      key: 'einkauf',
      title: 'Wocheneinkauf',
      location: 'Edeka',
      colorId: '6',
    }),
    timed(anchor, -2, '14:00', '15:30', {
      key: 'friseur',
      title: 'Friseur',
      location: 'Schnittstelle, Friedrichshain',
      colorId: '1',
    }),
    timed(anchor, -6, '17:00', '18:00', {
      key: 'schwimmen',
      title: 'Schwimmen',
      location: 'Stadtbad Neukölln',
      colorId: '7',
    }),
    allDay(anchor, -10, 1, {
      key: 'miete',
      title: 'Mietzahlung prüfen',
      colorId: '8',
    }),
  ];

  events.sort((a, b) =>
    String(a.start || a.startDate).localeCompare(String(b.start || b.startDate)),
  );
  return events;
}
