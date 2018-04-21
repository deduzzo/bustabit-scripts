import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import {AreaChart, CartesianGrid, XAxis, Tooltip, YAxis, Area, ResponsiveContainer} from 'recharts'

const mult = 900;
const bet = 1;

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
    //this.calculateAvgTimes(mult,bet,data);
      this.bestBets(100,1000,100, bet,data)
      return data;
  }

  dateFormat(date)
  {
    return date.getDate()  + "-" + (date.getMonth()+1) + "-" + date.getFullYear() + " " +
    date.getHours() + ":" + date.getMinutes();
  }


  calculateAvgTimes(val,bet,betData)
  {
    var data = []
    var data2 = betData.slice();
    data2 = data2.filter(p => p.bust >= val);
    console.log('d' + data2.length);
    var space = 0;
    for (var i = data2.length;i>1; i--)
    {
      var dataT = {id1: data2[i- 1].id, bust1: data2[i- 1].bust, id2:data2[i -2].id, bust2: data2[i -2].bust, diff: data2[i- 1].id - data2[i -2].id}
      console.log('1: ' + dataT.id1 + ' bust1:' +  dataT.bust1 + ' 2:' + dataT.id2 + ' bust2:' +  dataT.bust2 + ' diff:' + dataT.diff);
      data.push(dataT);
      space += data2[i- 1].id - data2[i -2].id;
    }
    space = space / (data2.length -1);
    console.log('midspace: ' + space);

    return {mid: space, balance: this.simulateBets(data,bet,space,val)}
  }

  simulateBets(data,bet,mid,val)
  {
      var totalWins = 0;
      data.forEach(b=>
      {
          var balance = 0;
          if (b.diff >= mid) {
              balance = (val * bet) - ((b.diff - mid) * bet);
              console.log('start id:' + b.id1 +' bet, and win ' + balance)
              totalWins += balance;
          }
          else
            console.log('not bet')
      });
      console.log('totalwins:' + totalWins)
      return totalWins;
  }

  bestBets(minMult, maxMult, step, bet, data)
  {
    var results=[]
    for (var i = minMult; i<=maxMult; i+=step)
      {
        results.push({mult: i, ...this.calculateAvgTimes(i,bet,data)});
      }
      console.log(results);
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
            {this.renderData(mult)}
        </div>
      </div>
    );
  }
}

export default App;
