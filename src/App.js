import React, { Component } from 'react';
import './App.css';
import timetable from './timetable.json';

class Timetable {
    constructor(name, stops) {
        this.name = name;
        this.stops = stops;
    }
}

class TimetableSelector extends Component {
    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
        console.log(props.timetables[0]);
        this.state = {
            timetable: props.timetables[0]
        };
    }

    handleChange(event) {
        console.log("A change was seen");
        console.log(event.target.value);
        this.setState({timetable: this.props.timetables.filter(t=>t.name=event.target.value)});
    }

    render() {
        return (
            <form>
                <select onChange={this.handleChange.bind(this)}>
                    {this.props.timetables.map((t,i)=><option key={i} value={t.name}>{t.name}</option>)}
                </select>
                <table>
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
    parseTimetable(timetableFrame, friendlyName) {
        return new Timetable(friendlyName, timetableFrame[0].vehicleJourneys.ServiceJourney.map(journey=>journey.calls.Call));
    }

    constructor(props) {
        super(props);

        this.state = {
            timetables: [this.parseTimetable(this.timetableForName(this.southboundName()), "Southbound"),
                this.parseTimetable(this.timetableForName(this.northboundName()), "Northbound")],
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
