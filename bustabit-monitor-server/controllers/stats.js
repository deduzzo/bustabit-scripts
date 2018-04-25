module.exports = function() {
    this.bestBets = function(minMult, maxMult, step, bet, data,correction)
    {
        var results=[]
        for (var i = minMult; i<=maxMult; i+=step)
        {
            results.push({mult: i, ...calculateAvgTimes(i,bet,data,correction)});
        }
        console.log(results);
        return results;
    }

    this.calculateAvgTimes = function(val,bet,betData, removeMaxMin)
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
        return {mid: space, balance: simulateBets(data2,bet,space,val), points: data2.length}
    }

    this.simulateBets = function(data,bet,mid,val)
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

    this.checkDataIntegrity = function(data)
    {
        var notOK = false;
        var values = []
        for (var i=0; i<data.length -1; i++)
            if (data[i+1].id - data[i].id >1)
            {
                notOK = true;
                console.log(data[i].id + ' ' + data[i+1].id)
                values.push(data[i+1].id);
            }

        return {integrity: !notOK, values: values};
    }
}

