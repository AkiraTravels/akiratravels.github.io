  var _gaq = _gaq || [];
  _gaq.push(['_setAccount', 'UA-39862083-1']);
  _gaq.push(['_trackPageview']);

  (function() {
    var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
    ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
  })();

function map()
{
	if (navigator.appName=='Netscape') {wa=15; ha=15;} else
	{if (navigator.appVersion.substring(0,1)=='2') {wa=10; ha=0;} else {wa=19; ha=28;}}
        window.open("images/map.gif","MAP","WIDTH="+(250+wa)+",HEIGHT="+(300+ha)+",RESIZABLE=YES");
}
function pic(f,w,h)
{
	if (navigator.appName=='Netscape') {wa=15; ha=15; wn='PIC';} else
	{wn='_blank'; if (navigator.appVersion.substring(0,1)=='2') {wa=10; ha=0;} else {wa=19; ha=28;}}
	window.open(f,wn,"WIDTH="+(w+wa)+",HEIGHT="+(h+ha)+",RESIZABLE=YES");
}
