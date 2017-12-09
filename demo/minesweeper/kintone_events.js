(function($){
"use strict";

//必須のひとたち
if($ == null || window.MineSweeper == null){ return; }

//レコード詳細ページの表示イベント
kintone.events.on([
		"app.record.detail.show"
	],
	function(event){

		//マインスイーパ本体のオブジェクトを作る。
		//戻り値はjQueryオブジェクトで、これを配置したいところに設置する。
		var $field = new MineSweeper();

		//ヘッダーメニュースペースにマインスイーパを設置するやりかた
		var $space = $(kintone.app.record.getHeaderMenuSpaceElement());

		//スペースにそのままappendしてもいいけどセンタリングしたり、
		//マインスイーパが複数設置されたりするのを回避するため、divのなかに入れます。
		var $div = $space.find(".mine-container");
		if($div.length === 0){
			$div = $('<div class="mine-container">').css("text-align", "center");
			$space.append($div);
		}
		$div.empty();
		$div.append( $field );

		return event;
	}
);

})(jQuery);
