let val = [];
var max = 0;
var n=0;
var everyNShow = 100000000;
var percentuali = {};
let allStats = [];
let i =0;
const NUM_PROVE = 5000;
while (i<=NUM_PROVE) {
    val = generate(280000);
    const VALORE_INFERIORE = 45
    const VALORE_SUPERIORE = 500000
    const VALORE_RIF = 3;
    const MAGGIORE_UGUALE = true;
    const MINORE = false;

    allStats.push([
        calcolaNumOccorrenzeValore(val, VALORE_INFERIORE,VALORE_RIF,MINORE),
        calcolaNumOccorrenzeValore(val, VALORE_SUPERIORE,VALORE_RIF,MAGGIORE_UGUALE)]
    );
    i++;
    if (i=== NUM_PROVE) {
        // show media guadagni
        let allGuadagni = [];
        for(let j=0; j<allStats.length; j++)
            allGuadagni.push(allStats[j][0].guadagno + allStats[j][1].guadagno);
        console.log("Media guadagni con rif " + VALORE_RIF +
            " <" + VALORE_INFERIORE + " e >" + VALORE_SUPERIORE + ": " +
            calcolaMediaValori(allGuadagni));
    }
    //var c = calculateMaxSeriesOf(val, 3);
/*    if (percentuali[c] != undefined) {
        var temp = percentuali[c];
        temp.quanti = percentuali[c].quanti +1;
        percentuali[c] = temp;
    }
    else
    {
        percentuali[c] = {quanti:1};
    }
    if (c>max)
        max = c;
    if (n% everyNShow == 0)
        console.log(showPercentuali(percentuali,max));*/
//console.log(arrayMax(val));
//console.log(countUp(val,1000000));
}

function showPercentuali(percentuali,max)
{
    //console.log(Object.keys(percentuali));
    for (var key in percentuali)
    {
        if (key != undefined)
        console.log(key, "-",percentuali[key].quanti, " max: ", max);
    }
}

function calcolaNumOccorrenzeValore(valori, valore,valorePrecGuadagno = 2,maggioreUguale = true) {
    let stats = {count:0, prec: [],med:0,guadagno:0}
    for (var i = 0; i < valori.length; i++) {
        if (valori[i] >= valore) {
            stats.count++;
            stats.prec.push(valori[i-1]);
            if (maggioreUguale) {
                if (valori[i - 1] >= valorePrecGuadagno)
                    stats.guadagno += valore;
            }
            else
            {
                if (valori[i - 1] < valorePrecGuadagno)
                    stats.guadagno += valore;
            }
        }
    }
    stats.med = calcolaMediaValori(stats.prec);
    return stats;
}

function calcolaMediaValori(valori) {
    return valori.reduce((a, b) => a + b, 0) / valori.length;
}

function calculateMaxSeriesOf(values, val)
{
    var max = 0;
    var maxEver =0;
    for (var i=0; i<values.length; i++) {
        if (values[i] >= val) {
            if (max > maxEver)
                maxEver = max;
            max = 0;
        } else
            max++
    }
    return maxEver;
}

function arrayMax(arr) {
    var len = arr.length, max = -Infinity;
    while (len--) {
        if (Number(arr[len]) > max) {
            max = Number(arr[len]);
        }
    }
    return max;
};

function countUp(arr,n) {
    var len = arr.length;
    var count = 0;
    while (len--) {
        if (Number(arr[len]) > n) {
            count++;
        }
    }
    return count;
};


function generate(n)
{
    let values = [];
    for (var index =0; index<n; index++)
        values.push(Math.floor(Math.max(0.99 / (1-Math.random()),1)* 100) / 100);
    return values;
}