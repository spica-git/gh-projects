(function($){
"use strict";

$(document).ready(function(){
	$("body")
	.prepend($((function(){/*
<h1 class="top"><a href="https://spica-git.github.io/gh-projects/">spica git</a></h1>
<ul class="navi">
	<li><a href="https://spica.tokyo/">Spica.tokyo</a></li>
	<li>Spica.tokyo &gt; kintone plugins</li>
</ul>
*/}).
toString().match(/\/\*([^]*)\*\//)[1]))
	.append($((function(){/*
<div class="footer">
	<div>&copy;spica.tokyo</div>
</div>
*/}).toString().match(/\/\*([^]*)\*\//)[1]));

	var $window = $(window);
	var $navi = $('ul.navi');
	var offset = $navi.offset();
	$window.scroll(function(){
		if($window.scrollTop() > offset.top){ $navi.addClass("fix"); }
		else{ $navi.removeClass("fix"); }
	});
});

})(jQuery);