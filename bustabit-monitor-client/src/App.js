import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import {AreaChart, CartesianGrid, XAxis, Tooltip, YAxis, Area, ResponsiveContainer} from 'recharts'

const mult = 1200;
const bet = 1;
const correction = false;

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
      var dataEdit = self.transformData(data.sort((p1, p2)=>
      {
        if(p1.id > p2.id)
          return 1
        else return -1
      }));
      console.log('%c data integrity:' + self.checkDataIntegrity(dataEdit),'background: yellow; color: red')
      console.log('%c ' + dataEdit.length + ' ' + self.checkDataIntegrity(dataEdit),'background: green; color: white')
      console.log(self.checkLongestBadSeries(dataEdit, 2))
      that.setState({ vals: dataEdit.slice() });
    });
  }

  transformData(data)
  {
    data.forEach(bust => {
      var totalBets = 0;
      var totalWins = 0;
      var totalLosts = 0;
      if (bust.bets === undefined)
        bust.bets = {}
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
    //this.calculateAvgTimes(mult,bet,data);
      this.bestBets(400,5000,100, bet,data)
      return data;
  }

  dateFormat(date)
  {
    return date.getDate()  + "-" + (date.getMonth()+1) + "-" + date.getFullYear() + " " +
    date.getHours() + ":" + date.getMinutes();
  }


  calculateAvgTimes(val,bet,betData, removeMaxMin)
  {
    var data2 = betData.slice();
    data2 = data2.filter(p => p.bust >= val);
    console.log('%c ---------- mult ----------  ' + val, 'background: #222; color: #bada55');
    var space = 0;
    var maxSpace = 0;
    var minSpace = -1;
    for (var i = data2.length;i>1; i--)
    {
      var dataT = {id1: data2[i- 1].id, bust1: data2[i- 1].bust, id2:data2[i -2].id, bust2: data2[i -2].bust, diff: data2[i- 1].id - data2[i -2].id}
      console.log('1: ' + dataT.id1 + ' bust1:' +  dataT.bust1 + ' 2:' + dataT.id2 + ' bust2:' +  dataT.bust2 + ' diff:' + dataT.diff);
      var tempSpace = data2[i- 1].id - data2[i -2].id;
      space += tempSpace;
      if (tempSpace < minSpace || minSpace === -1)
        minSpace = tempSpace;
      if (tempSpace > maxSpace)
        maxSpace = tempSpace;
    }
    if (!removeMaxMin || (data2.length <4))
      space = space / (data2.length -1);
    else
    {
      space -= (maxSpace + minSpace);
      space = space / (data2.length -3);
    }
    console.log('midspace: ' + space);
    console.log((!removeMaxMin || (data2.length <4)) ? 'NO CORRECTION' : 'MAXMIN CORRECTION');
    return {mid: space, balance: this.simulateBets(data2,bet,space,val), points: data2.length}
  }

  simulateBets(data,bet,mid,val)
  {
      var totalWins = 0;
      for (var i=0; i<data.length-1; i++)
      {
          var balance = 0;
          var diff;
          diff = (data[i+1].id - data[i].id)
          if (diff >= mid) {
              balance = (val * bet) - ((diff - mid) * bet);
              console.log('start id:' + data[i].id +' bet, and win ' + balance + '(dopo ' + (diff - mid) + ' puntate)')
              totalWins += balance;
          }
          else
            console.log(data[i].id + ' not bet (' + diff +'<' + mid + ')')
      };
      console.log('%c totalwins:' + totalWins, totalWins >0 ?'background: blue; color: yellow' : 'background: red; color: orange')
      return totalWins;
  }

  checkDataIntegrity(data)
  {
      var notOK = false;
      var values = [];
      for (var i=0; i<data.length -1; i++)
          if (data[i+1].id - data[i].id >1)
          {
              notOK = true;
              console.log(data[i].id + ' ' + data[i+1].id)
              values.push(data[i+1].id);
          }
    return !notOK;
  }

  checkLongestBadSeries(data, val)
  {
      var num = 0;
      var tempNum = 0;
      var series = []
      var tempSeries = []
      for (var i=0; i<data.length; i++)
          if (data[i].bust <val)
          {
              tempNum++;
              tempSeries.push({bust: data[i].bust, data: data[i].data, id: data[i].id})
          }
          else {
              if (tempNum > num) {
                  num = tempNum;
                  series = tempSeries;
              }
              tempSeries = []
              tempNum = 0;
          }
      if (tempNum > num) {
          num = tempNum;
          series = tempSeries;
      }
       return {num: num, series: series}
  }

  bestBets(minMult, maxMult, step, bet, data)
  {
    var results=[]
    for (var i = minMult; i<=maxMult; i+=step)
      {
        results.push({mult: i, ...this.calculateAvgTimes(i,bet,data,correction)});
      }
      console.log(results);
    return results;
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
      var showGraph = false;
        var last100 = this.state.vals.slice(this.state.vals.length -1000, this.state.vals.length)
        var show = <div>
            <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={last100}
                           margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey='id' />
                    <YAxis scale="sqrt" />
                    <Tooltip/>
                    <Area type='monotone' dataKey='bust' stackId="1" stroke='#ACAACAC' fill='#ACAACAC' />
                </AreaChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={300}>
                <AreaChart width={1500} height={300} data={last100}
                           margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey='id' />
                    <YAxis scale="sqrt"/>
                    <Tooltip/>
                    <Area type='monotone' dataKey='totalBets' stackId="2" stroke='#8884d8' fill='#8884d8' />
                </AreaChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={300}>
                <AreaChart width={1500} height={300} data={last100}
                           margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey='id' />
                    <YAxis scale="sqrt"/>
                    <Tooltip/>
                    <Area type='monotone' dataKey='totalLosts' stackId="4" stroke='#CACACA' fill='#CACACA' />
                </AreaChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={300}>
                <AreaChart width={1500} height={300} data={last100}
                           margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis />
                    <YAxis scale="sqrt"/>
                    <Tooltip/>
                    <Area type='monotone' dataKey='totalWins' stackId="3" stroke='#BABABA' fill='#141414' />
                </AreaChart>
            </ResponsiveContainer>

            <ResponsiveContainer width="100%" height={600}>
                <AreaChart data={this.state.vals}
                           margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey='id' />
                    <YAxis scale="sqrt" domain={[1,100]} allowDataOverflow={true} />
                    <Tooltip/>
                    <Area type='monotone' dataKey='bust' stackId="1" stroke='#ACAACAC' fill='#ACAACAC' />
                </AreaChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={600}>
                <AreaChart data={this.state.vals}
                           margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey='id' />
                    <YAxis scale="sqrt" domain={[1,100]} allowDataOverflow={true} />
                    <Tooltip/>
                    <Area type='monotone' dataKey='bust' stackId="1" stroke='#ACAACAC' fill='#ACAACAC' />
                </AreaChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={300}>
                <AreaChart width={1500} height={300} data={this.state.vals}
                           margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey='id' />
                    <YAxis scale="sqrt"/>
                    <Tooltip/>
                    <Area type='monotone' dataKey='totalBets' stackId="2" stroke='#8884d8' fill='#8884d8' />
                </AreaChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={300}>
                <AreaChart width={1500} height={300} data={this.state.vals}
                           margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey='id' />
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
        </div>

        return (
            <div className="App">
                <header className="App-header">
                    <img src={logo} className="App-logo" alt="logo" />
                    <h1 className="App-title">Welcome to React</h1>
                </header>
                <div>
                    {showGraph === true ? show : <div></div>}
                    {this.renderData(mult)}
                </div>
            </div>
        );
    }
}

export default App;
