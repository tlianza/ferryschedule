import React, { Component } from 'react';
import './App.css';
import timetable from './timetable.json';

class Timetable {
    constructor(name, stops, validUntil) {
        this.name = name;
        this.stops = stops;
        this.validUntil = new Date(validUntil);

        //The name encodes properties of the timetable ex. LF:S :Weekday
        const nameParts = name.split(':');
        this.direction = nameParts[1].trim();
        this.schedule  = nameParts[2].trim();
    }

    friendlyColumns() {
        const NORTHBOUND_COLUMNS = ["Departs Ferry Bldg", "Arrives Larkspur"];
        const SOUTHBOUND_COLUMNS = ["Departs Larkspur", "Arrives Ferry Bldg"];

        return (this.direction === 'N') ? NORTHBOUND_COLUMNS : SOUTHBOUND_COLUMNS;
    }

    friendlyDirection() {
        return (this.direction === 'N') ? "Northbound" : "Southbound";
    }

    friendlySchedulename() {
        return (this.schedule) === 'Saturday' ? 'Weekend & Holiday' : this.schedule;
    }

    friendlyName() {
        return `${this.friendlySchedulename()}: ${this.friendlyDirection()}`
    }
}

class TimetableSelector extends Component {

    // Returns the name that the timetable dataset will use to represent 'today'
    static getTimetableNameForToday() {
        const day = new Date().getDay();
        switch(day){
            case 0:
            case 6:
                return 'Saturday';
            default:
                return 'Weekday';
        }
    }

    static getDefaultTimetableName() {
        return `LF:S :${TimetableSelector.getTimetableNameForToday()}`;
    }

    //Used for when you want special, time-aware treatment for when someone is looking at today's schedule
    static isToday(value) {
        return (value === `LF:S :${TimetableSelector.getTimetableNameForToday()}` || value === `LF:N :${TimetableSelector.getTimetableNameForToday()}`);
    }

    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);

        this.state = {
            timetable: props.timetables.filter(t=>t.name===TimetableSelector.getDefaultTimetableName())[0],
            value: TimetableSelector.getDefaultTimetableName(),
            isToday: TimetableSelector.isToday(TimetableSelector.getDefaultTimetableName())
        };
    }

    handleChange(event) {
        const newTimetable = this.props.timetables.filter(t=>t.name===event.target.value)[0];
        const isToday = TimetableSelector.isToday(event.target.value);
        this.setState((state, props) => ({
            timetable: newTimetable,
            value: props.value,
            isToday: isToday
        }));
    }

    render() {
        return (
            <div className="container">
                <nav className="navbar navbar-expand-lg navbar-light bg-light">
                    <a className="navbar-brand" href="/">Larkspur Ferry</a>
                    <form className="form-inline my-2 my-lg-0">
                        <select onChange={this.handleChange.bind(this)} value={this.state.value}>
                            {this.props.timetables.map((t,i)=><option key={i} value={t.name}>{t.friendlyName()}</option>)}
                        </select>
                    </form>
                </nav>

                <table className="table table-sm">
                    <thead>
                        <tr>
                            {this.state.timetable.friendlyColumns().map((r,c)=><th key={c} scope="col">{r}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        <TimetableList timetable={this.state.timetable} highlightNow={this.state.isToday}/>
                    </tbody>
                </table>

                <p>
                    See <a href="http://goldengateferry.org/schedules/Larkspur.php">Full Schedule</a><br />
                    <small>Schedule valid until: {this.state.timetable.validUntil.toLocaleDateString()}&nbsp;</small>
                    <small>Data courtesy <a href="https://511.org/">511.org</a></small>
                </p>

            </div>
        );
    }
}

class TimetableList extends Component {

    static friendlyTime(uglyTime) {
        const parts = uglyTime.split(':');
        const h24 = parts[0];
        const ampm = h24 > 11 ? 'p' : 'a';
        const h = h24 > 12 ? h24-12 : h24;
        return `${h}:${parts[1]}${ampm}`;
    }

    static minutesOfDay(uglyTime) {
        const parts = uglyTime.split(':');
        const h = parseInt(parts[0]);
        const m = parseInt(parts[1]);
        return (60*h)+m;
    }

    className(uglyTime, column) {
        if (!this.props.highlightNow) {
            return '';
        }
        const now = new Date();
        const nowmins = (60*now.getHours())+now.getMinutes();
        const allmins = TimetableList.minutesOfDay(uglyTime);

        if (nowmins > allmins) {
            return 'text-muted'
        }

        if (column === 0 && allmins-nowmins < 15) {
            return 'text-danger';
        }

        if (column === 0 && allmins-nowmins < 60) {
            return 'text-primary';
        }

        return '';
    }

    render() {
        return (
            this.props.timetable.stops.map((s,i)=>
                <tr key={i}>
                    {s.map((r,c)=><td key={c} className={this.className(r.Arrival.Time, c)}>{TimetableList.friendlyTime(r.Arrival.Time)}</td>)}
                </tr>
            )
        )
    }
}

class App extends Component {

    timetableForName(name) {
        return timetable.Content.TimetableFrame.filter(obj=>obj.Name===name);
    }

    // Given a timetable object, returns a 2 dimensional array where each row
    // is a route, and each column is a stop on that route. The values are the times (arrival & departure,
    // which may be the same).
    static parseTimetable(name, timetableFrame) {
        if(timetableFrame.length === 0) {
            console.error(`Got empty timetable for ${name}`);
            return new Timetable(`${name} (Empty!!)`);
        }
        return new Timetable(name, timetableFrame[0].vehicleJourneys.ServiceJourney.map(journey=>journey.calls.Call), timetableFrame[0].frameValidityConditions.AvailabilityCondition.ToDate);
    }

    constructor(props) {
        super(props);

        //This is coded as a constant so we ensure the dropdown order is constant
        const TIMETABLES_SHOWN   = ["LF:S :Weekday", "LF:N :Weekday", "LF:S :Saturday", "LF:N :Saturday"];

        this.state = {
            timetables: TIMETABLES_SHOWN.map(timetable=>App.parseTimetable(timetable, this.timetableForName(timetable)))
        };
    }

  render() {
    return (
      <div className="App">
          <TimetableSelector timetables={this.state.timetables} />
      </div>
    );
  }
}

export default App;
