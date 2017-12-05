(function($){
"use strict";

//jQueryとMineSwpperオブジェクトが必須です
if($ == null || window.MineSweeper == null){ return; }

kintone.events.on(
	"app.record.detail.show",
	function(event){

		var $field = (new MineSweeper({
			difficulty: "normal",
		}));

		var $space = $(kintone.app.record.getHeaderMenuSpaceElement());
		$space.find(".mine-container").remove();
		$space.append(
			$('<div class="mine-container">').css("text-align", "center").append( $field )
		);

		return event;
	}
);

})(window.jQuery);
