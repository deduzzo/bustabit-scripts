let val = [];
var max = 0;
var n=0;
var everyNShow = 100000000;
var percentuali = {};
while (true) {
    val = generate(10000000);
    var c = calculateMaxSeriesOf(val, 3);
    if (percentuali[c] != undefined) {
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
        console.log(showPercentuali(percentuali,max));
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