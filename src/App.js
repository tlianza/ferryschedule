import React, { Component } from 'react';
import './App.css';
import timetable from './timetable.json';

class Timetable {
    constructor(name, friendlyColumns, stops, validUntil) {
        this.name = name;
        this.friendlyColumns = friendlyColumns;
        this.stops = stops;
        this.validUntil = validUntil;
    }
}

class TimetableSelector extends Component {
    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
        this.state = {
            timetable: props.timetables[0]
        };
    }

    handleChange(event) {
        const newTimetable = this.props.timetables.filter(t=>t.name===event.target.value);
        this.setState((state, props) => ({
            timetable: newTimetable[0]
        }));
    }

    render() {
        return (
            <div className="container">
                <nav className="navbar navbar-expand-lg navbar-light bg-light">
                    <a className="navbar-brand" href="/">Larkspur Ferry</a>
                    <form className="form-inline my-2 my-lg-0">
                        <select onChange={this.handleChange.bind(this)}>
                            {this.props.timetables.map((t,i)=><option key={i} value={t.name}>{t.name}</option>)}
                        </select>
                    </form>
                </nav>

                <table className="table table-sm">
                    <thead>
                        <tr>
                            {this.state.timetable.friendlyColumns.map((r,c)=><th key={c} scope="col">{r}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        <TimetableList timetable={this.state.timetable}/>
                    </tbody>
                </table>

                <p>
                    See <a href="http://goldengateferry.org/schedules/Larkspur.php">Full Schedule</a><br />
                    <small>Schedule valid until: {this.state.timetable.validUntil}&nbsp;</small>
                    <small>Data courtesy <a href="https://511.org/">511.org</a></small>
                </p>

            </div>
        );
    }
}

class TimetableList extends Component {
    render() {
        return (
            this.props.timetable.stops.map((s,i)=>
                <tr key={i}>
                    {s.map((r,c)=><td key={c}>{r.Arrival.Time}</td>)}
                </tr>
            )
        )
    }
}

class App extends Component {

    getDay() {
        const day = new Date().getDay();
        switch(day){
            case 0:
                return 'Sunday';
            case 6:
                return 'Saturday';
            default:
                return 'Weekday';
        }
    }
    northboundName() {
        return `LF:N :${this.getDay()}`;
    }

    southboundName() {
        return `LF:S :${this.getDay()}`;
    }

    timetableForName(name) {
        return timetable.Content.TimetableFrame.filter(obj=>obj.Name===name);
    }

    // Given a timetable object, returns a 2 dimensional array where each row
    // is a route, and each column is a stop on that route. The values are the times (arrival & departure,
    // which may be the same).
    parseTimetable(timetableFrame, friendlyColumns, friendlyName) {
        return new Timetable(friendlyName, friendlyColumns, timetableFrame[0].vehicleJourneys.ServiceJourney.map(journey=>journey.calls.Call), timetableFrame[0].frameValidityConditions.AvailabilityCondition.ToDate);
    }

    constructor(props) {
        super(props);

        this.state = {
            timetables: [this.parseTimetable(this.timetableForName(this.southboundName()), ["Departs Larkspur", "Arrives Ferry Bldg"], "Southbound"),
                this.parseTimetable(this.timetableForName(this.northboundName()), ["Departs Ferry Bldg", "Arrives Larkspur"], "Northbound")],
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
