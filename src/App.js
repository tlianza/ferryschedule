import React, { Component } from 'react';
import './App.css';
import timetable from './timetable.json';

class Timetable {
    constructor(name, friendlyColumns, stops) {
        this.name = name;
        this.friendlyColumns = friendlyColumns;
        this.stops = stops;
    }
}

class TimetableSelector extends Component {
    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
        this.state = {
            timetable: props.timetables[0]
        };
        console.log("TIMETABLE SELECTOR");
        console.log(this.state.timetable);
    }

    handleChange(event) {
        console.log("A change was seen");
        console.log(event.target.value);
        const newTimetable = this.props.timetables.filter(t=>t.name===event.target.value);
        this.setState((state, props) => ({
            timetable: newTimetable[0]
        }));
    }

    render() {
        return (
            <form>
                <select onChange={this.handleChange.bind(this)}>
                    {this.props.timetables.map((t,i)=><option key={i} value={t.name}>{t.name}</option>)}
                </select>
                <table>
                    <thead>
                        <tr>
                            {this.state.timetable.friendlyColumns.map((r,c)=><th key={c}>{r}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        <TimetableList timetable={this.state.timetable}/>
                    </tbody>
                </table>
            </form>
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
        return new Timetable(friendlyName, friendlyColumns, timetableFrame[0].vehicleJourneys.ServiceJourney.map(journey=>journey.calls.Call));
    }

    constructor(props) {
        super(props);

        this.state = {
            timetables: [this.parseTimetable(this.timetableForName(this.southboundName()), ["Departs Larkspur", "Arrives Ferry Bldg"], "Southbound"),
                this.parseTimetable(this.timetableForName(this.northboundName()), ["Departs Ferry Bldg", "Arrives Larkspur"], "Northbound")],
        };

        console.log(timetable.Content.TimetableFrame);
        console.log(this.state);
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
