import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import {AreaChart, CartesianGrid, XAxis, Tooltip, YAxis, Area, ResponsiveContainer} from 'recharts'

class App extends Component {

  constructor(props)
  {
    super(props);
    this.transformData = this.transformData.bind(this);
    this.state = 
    {
      vals: [],
    }
  }


  componentDidMount() {    
    var that = this;
    var url = 'http://server2.erainformatica.it:3000/busts/'
    var self = this;
    fetch(url)
    .then(function(response) {
      if (response.status >= 400) {
        throw new Error("Bad response from server");
      }
      return response.json();
    })
    .then(function(data) {
      console.log('data:' + data)
      var dataEdit = self.transformData(data);
      that.setState({ vals: dataEdit.slice() });
      console.log(dataEdit);
    });
  }

  transformData(data)
  {
    var avg = 0;
    data.forEach(bust => {
      avg += bust.bust;
      var totalBets = 0;
      var totalWins = 0;
      var totalLosts = 0;
      for (const key of Object.keys(bust.bets)) {
        if (bust.bust >= bust.bets[key].payout)
          totalWins += ((bust.bets[key].wager / 100) * bust.bets[key].payout) - (bust.bets[key].wager /100);
        else
          totalLosts += bust.bets[key].wager / 100;
        totalBets += bust.bets[key].wager /100;
    }
      bust.totalBets = totalBets;
      bust.totalWins = totalWins;
      bust.totalLosts = totalLosts;
    });
    avg = avg / data.length;
    console.log("avg:" + avg);
    this.calculateAvgTimes(2000,data)
    return data;
  }

  dateFormat(date)
  {
    return date.getDate()  + "-" + (date.getMonth()+1) + "-" + date.getFullYear() + " " +
    date.getHours() + ":" + date.getMinutes();
  }

  calculateAvgTimes(val,data)
  {
    var data2 = data.slice();
    data2 = data2.filter(p => p.bust >= val);
    console.log('d' + data2.length);
    var space = 0;
    for (var i = data2.length;i>1; i--)
    {
      console.log('1: ' + data2[i- 1].id + ' bust1:' +  data2[i- 1].bust + ' 2:' + data2[i -2].id + ' bust2:' +  data2[i -2].bust + ' diff:' + (data2[i- 1].id - data2[i -2].id));
      space += data2[i- 1].id - data2[i -2].id;
    }
    space = space / (data2.length -1);
    console.log('midspace: ' + space);
  }

  renderData(maxValue)
  {
    return this.state.vals.map(item =>(
      item.bust > maxValue ?
        <li key={item.id} style={{color: item.bust >maxValue ? 'red': 'blue'}}>
        {item.id} - {this.dateFormat(new Date(item.date))} - {item.bust}
        </li>
        : ''
    ));
  }
  

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Welcome to React</h1>
        </header>
        <div>
          <ResponsiveContainer width="100%" height={600}>
            <AreaChart data={this.state.vals}
                  margin={{top: 10, right: 30, left: 0, bottom: 0}}>
              <CartesianGrid strokeDasharray="3 3"/>
              <XAxis />
              <YAxis scale="sqrt" domain={[1,100]} allowDataOverflow={true} />
              <Tooltip/>
              <Area type='monotone' dataKey='bust' stackId="1" stroke='#ACAACAC' fill='#ACAACAC' />
            </AreaChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart width={1500} height={300} data={this.state.vals}
                  margin={{top: 10, right: 30, left: 0, bottom: 0}}>
              <CartesianGrid strokeDasharray="3 3"/>
              <XAxis />
              <YAxis scale="sqrt"/>
              <Tooltip/>
              <Area type='monotone' dataKey='totalBets' stackId="2" stroke='#8884d8' fill='#8884d8' />
            </AreaChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart width={1500} height={300} data={this.state.vals}
                  margin={{top: 10, right: 30, left: 0, bottom: 0}}>
              <CartesianGrid strokeDasharray="3 3"/>
              <XAxis />
              <YAxis scale="sqrt"/>
              <Tooltip/>
              <Area type='monotone' dataKey='totalLosts' stackId="4" stroke='#CACACA' fill='#CACACA' />
            </AreaChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart width={1500} height={300} data={this.state.vals}
                  margin={{top: 10, right: 30, left: 0, bottom: 0}}>
              <CartesianGrid strokeDasharray="3 3"/>
              <XAxis />
              <YAxis scale="sqrt"/>
              <Tooltip/>
              <Area type='monotone' dataKey='totalWins' stackId="3" stroke='#BABABA' fill='#141414' />
            </AreaChart>
          </ResponsiveContainer>
            {this.renderData(17)}
        </div>
      </div>
    );
  }
}

export default App;
