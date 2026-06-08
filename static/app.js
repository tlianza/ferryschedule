const NORTHBOUND_COLUMNS = ["Departs Ferry Bldg", "Arrives Larkspur"];
const SOUTHBOUND_COLUMNS = ["Departs Larkspur", "Arrives Ferry Bldg"];
const NORTHBOUND_DEFAULT_GEO = [37.7955, -122.3937];
const SOUTHBOUND_DEFAULT_GEO = [37.946499, -122.509532];
const DIRECTION_ORDER = ["S", "N"];
const SCHEDULE_ORDER = ["Weekday", "Weekend", "Saturday", "Sunday", "Holiday"];

function distanceMiles(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const radlat1 = (Math.PI * lat1) / 180;
  const radlat2 = (Math.PI * lat2) / 180;
  const theta = lon1 - lon2;
  const radtheta = (Math.PI * theta) / 180;
  let dist =
    Math.sin(radlat1) * Math.sin(radlat2) +
    Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
  dist = Math.min(1, dist);
  dist = Math.acos(dist);
  dist = (dist * 180) / Math.PI;
  return dist * 60 * 1.1515;
}

function scheduleNameForToday(availableSchedules) {
  const day = new Date().getDay();
  const isWeekend = day === 0 || day === 6;

  if (!isWeekend) return "Weekday";
  if (availableSchedules.has("Weekend")) return "Weekend";
  if (day === 6 && availableSchedules.has("Saturday")) return "Saturday";
  if (day === 0 && availableSchedules.has("Sunday")) return "Sunday";
  if (availableSchedules.has("Saturday")) return "Saturday";
  if (availableSchedules.has("Sunday")) return "Sunday";
  return "Weekend";
}

function defaultTimetableName(lineId, scheduleName, direction = "S") {
  return `${lineId}:${direction} :${scheduleName}`;
}

function isTodaySchedule(name, lineId, scheduleName) {
  return (
    name === defaultTimetableName(lineId, scheduleName, "N") ||
    name === defaultTimetableName(lineId, scheduleName, "S")
  );
}

function minutesOfDay(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function friendlyTime(hhmm) {
  const [hours, mins] = hhmm.split(":").map(Number);
  const ampm = hours >= 12 ? "p" : "a";
  const h12 = hours > 12 ? hours - 12 : hours;
  return `${h12}:${String(mins).padStart(2, "0")}${ampm}`;
}

function parseTimetableFrame(name, timetableFrame) {
  if (!timetableFrame || timetableFrame.length === 0) {
    return null;
  }
  const frame = timetableFrame[0];
  const parts = name.split(":");
  const lineId = parts[0].trim();
  const direction = parts[1].trim();
  const schedule = parts[2].trim();

  return {
    name,
    lineId,
    direction,
    schedule,
    stops: frame.vehicleJourneys.ServiceJourney.map((journey) => journey.calls.Call),
    validUntil: new Date(frame.frameValidityConditions.AvailabilityCondition.ToDate),
  };
}

function columnsForDirection(direction) {
  return direction === "N" ? NORTHBOUND_COLUMNS : SOUTHBOUND_COLUMNS;
}

function friendlyName(timetable) {
  const scheduleName =
    timetable.schedule === "Saturday" || timetable.schedule === "Weekend"
      ? "Weekend & Holiday"
      : timetable.schedule;
  const dirName = timetable.direction === "N" ? "Northbound" : "Southbound";
  return `${scheduleName}: ${dirName}`;
}

function sortTimetables(timetables) {
  return timetables.sort((a, b) => {
    const directionA = DIRECTION_ORDER.indexOf(a.direction);
    const directionB = DIRECTION_ORDER.indexOf(b.direction);
    if (directionA !== directionB) return directionA - directionB;

    const scheduleA = SCHEDULE_ORDER.indexOf(a.schedule);
    const scheduleB = SCHEDULE_ORDER.indexOf(b.schedule);
    if (scheduleA !== scheduleB) return scheduleA - scheduleB;

    return a.name.localeCompare(b.name);
  });
}

function rowClass(hhmm, nowMins) {
  const departureMins = minutesOfDay(hhmm);
  if (nowMins > departureMins) return "past";
  if (departureMins - nowMins < 15) return "now";
  if (departureMins - nowMins < 60) return "soon";
  return "";
}

async function loadTimetables() {
  const response = await fetch("/data/timetable.json");
  const rawText = await response.text();
  const normalized = rawText.replace(/^\uFEFF/, "");
  const data = JSON.parse(normalized);
  const allFrames = data.Content.TimetableFrame;
  const timetables = allFrames.map((frame) => parseTimetableFrame(frame.Name, [frame])).filter(Boolean);
  return sortTimetables(timetables);
}

function renderRows(timetable, tbody, highlightNow) {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  tbody.innerHTML = timetable.stops
    .map((stopRow) => {
      const departureTime = stopRow[0].Arrival.Time;
      const arrivalTime = stopRow[1].Arrival.Time;
      const className = highlightNow ? rowClass(departureTime, nowMins) : "";

      return `<tr>
        <td class="${className}">${friendlyTime(departureTime)}</td>
        <td>${friendlyTime(arrivalTime)}</td>
      </tr>`;
    })
    .join("");
}

async function inferDirectionFromLocation() {
  if (!navigator.geolocation) return "S";
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nDistance = distanceMiles(
          position.coords.latitude,
          position.coords.longitude,
          NORTHBOUND_DEFAULT_GEO[0],
          NORTHBOUND_DEFAULT_GEO[1],
        );
        const sDistance = distanceMiles(
          position.coords.latitude,
          position.coords.longitude,
          SOUTHBOUND_DEFAULT_GEO[0],
          SOUTHBOUND_DEFAULT_GEO[1],
        );
        resolve(nDistance < sDistance ? "N" : "S");
      },
      () => resolve("S"),
      { timeout: 3000 },
    );
  });
}

async function loadAlerts() {
  const response = await fetch("/data/alerts.json");
  if (!response.ok) return { alerts: [], error: `http_${response.status}`, feedTimestamp: null };
  const data = await response.json();
  return {
    alerts: Array.isArray(data.alerts) ? data.alerts : [],
    error: data.error || null,
    feedTimestamp: data.feedTimestamp ?? null,
  };
}

// feedTimestamp is the 511 feed's publish time (POSIX seconds).
function formatCheckedAt(feedTimestamp) {
  return new Date(feedTimestamp * 1000).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function renderAlerts(alerts, container, { feedTimestamp, error } = {}) {
  container.innerHTML = "";

  // Couldn't actually reach the feed: stay quiet rather than imply all-clear.
  if (!alerts.length && error) {
    container.classList.remove("is-empty");
    container.hidden = true;
    return;
  }

  const heading = document.createElement("h2");
  container.appendChild(heading);

  if (!alerts.length) {
    // All-clear: say so in the title, with just the last-checked time below.
    container.classList.add("is-empty");
    heading.textContent = "Service Alerts: None";

    if (feedTimestamp) {
      const stamp = document.createElement("p");
      stamp.className = "alert-checked";
      stamp.textContent = `Last checked ${formatCheckedAt(feedTimestamp)}.`;
      container.appendChild(stamp);
    }

    container.hidden = false;
    return;
  }

  container.classList.remove("is-empty");
  heading.textContent = alerts.length === 1 ? "Service Alert" : "Service Alerts";

  // Build nodes with textContent so feed text can never inject markup.
  alerts.forEach((alert) => {
    const card = document.createElement("article");
    card.className = "alert";

    if (alert.header) {
      const header = document.createElement("p");
      header.className = "alert-header";
      header.textContent = alert.header;
      card.appendChild(header);
    }
    if (alert.description) {
      const desc = document.createElement("p");
      desc.className = "alert-desc";
      desc.textContent = alert.description;
      card.appendChild(desc);
    }
    container.appendChild(card);
  });

  container.hidden = false;
}

async function initAlerts() {
  const container = document.querySelector("#alerts");
  if (!container) return;
  try {
    const { alerts, error, feedTimestamp } = await loadAlerts();
    renderAlerts(alerts, container, { feedTimestamp, error });
  } catch (error) {
    // Alerts are supplementary; never let a failure here break the schedule.
    console.error("Could not load service alerts", error);
  }
}

async function boot() {
  initAlerts();

  const select = document.querySelector("#schedule-select");
  const status = document.querySelector("#status");
  const title = document.querySelector("#table-title");
  const validUntil = document.querySelector("#valid-until");
  const departureCol = document.querySelector("#departure-col");
  const arrivalCol = document.querySelector("#arrival-col");
  const rows = document.querySelector("#schedule-rows");

  try {
    const timetables = await loadTimetables();
    if (timetables.length === 0) {
      status.textContent = "No timetable entries found in data file.";
      return;
    }

    const lineId = timetables[0].lineId;
    const availableSchedules = new Set(timetables.map((timetable) => timetable.schedule));
    const todaySchedule = scheduleNameForToday(availableSchedules);
    const defaultDirection = await inferDirectionFromLocation();
    const defaultName = defaultTimetableName(lineId, todaySchedule, defaultDirection);

    timetables.forEach((timetable) => {
      const option = document.createElement("option");
      option.value = timetable.name;
      option.textContent = friendlyName(timetable);
      select.appendChild(option);
    });

    const tableByName = new Map(timetables.map((t) => [t.name, t]));
    select.value = tableByName.has(defaultName) ? defaultName : timetables[0]?.name;

    const paint = () => {
      const active = tableByName.get(select.value);
      if (!active) return;
      const [departure, arrival] = columnsForDirection(active.direction);
      departureCol.textContent = departure;
      arrivalCol.textContent = arrival;
      title.textContent = friendlyName(active);
      validUntil.textContent = `Schedule valid until ${active.validUntil.toLocaleDateString()}.`;
      const highlightNow = isTodaySchedule(active.name, lineId, todaySchedule);
      renderRows(active, rows, highlightNow);
      status.textContent = "";
    };

    select.addEventListener("change", paint);
    paint();
  } catch (error) {
    status.textContent = "Could not load schedule data. Please refresh.";
    console.error(error);
  }
}

boot();
