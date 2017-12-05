/**
 * @license
 * Copyright (c) spica.tokyo
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
window.MineSweeper = (function($){
"use strict";

//jQuery必須です
if($ == null){ return null; }

/**
 * シード設定できる乱数
 * @param {null|Array|number} arg 
 * 		配列を渡すと添字0の値をシードにして初期化します
 * 			[number] -> シード
 * 			[] -> タイムスタンプ
 * 			[true] -> 88675123
 * 		数値を渡すと未満の乱数を取得します
 * 			Random(1000) -> 0～999
 * 
 * 		インスタンスにする場合
 * 			var rnd1 = new Random();				//タイプスタンプをシードにしたインスタンス
 * 			var rnd2 = new Random([999]);	//999をシードにしたインスタンス
 * 			rnd1とrnd2は別々のシードを持つ乱数生成オブジェクトとなる。
 */
function Random (arg){
	if(this instanceof Random){
		var _fn = function (_arg){
			if(_arg instanceof Array){
				_fn.x = 123456789; _fn.y = 362436069; _fn.z = 521288629;
				var seed = isNaN(_arg[0]) ? null : _arg[0];
				_fn.w = (seed !== true ? seed == null ? Date.now() : seed : 88675123) % 1e8;
				return;
			}
			//XorShiftで生成
			if(_fn.w == null){ _fn([true]); }
			var val = _fn.x ^ (_fn.x << 11);
			_fn.x = _fn.y; _fn.y = _fn.z; _fn.z = _fn.w;
			val = Math.abs(_fn.w = (_fn.w ^ (_fn.w >>> 19)) ^ (val ^ (val >>> 8)));
			return isNaN(_arg) ? val : val % Math.abs(parseInt(_arg, 10));
		}
		_fn(arg instanceof Array ? arg : []);
		return _fn;
	}

	if(Random.fn == null){ Random.fn = new Random(); }
	return Random.fn(arg);
}

//◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆
// マインスイーパー本体
//◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆◆
//-----------------------------------------------------------------------
/**
 * 地雷原フィールドセルクラス
 * @constructor
 * @param {null|boolean} _isbomb 
 */
function MineCell(_FieldObj, _isBomb){
	if(!(this instanceof MineCell)) { return; }
	this.FieldObj = _FieldObj;

	var size_style = this.FieldObj.CellSize + "px";

	//DOM要素作成
	this.$e = $('<td class="mine mine-hide">')
		.css({ "min-width": size_style, "width": size_style, "height": size_style})
		.append($('<p>').css({ "width": size_style, "height": size_style }))
		.on("click", (function(_e){
			if(!this.open){
				if(this.FieldObj._interval_id == null){
					this.FieldObj.gamestart();
				}
				this.Dig();

				this.FieldObj.info.Left++;

				this.FieldObj.refresh_info();
				this.FieldObj.ClearCheck();
			}
		}.bind(this)))
		.on("contextmenu", this.Alt.bind(this));



	//if(_option.isBomb){
	//	this.$e.css("background-color","#ffd0d0");
		//field.mines[index].$e.removeClass("mine-hide");
		//field.mines[index].$e.addClass("mine-open");
	//}

	this.bomb = !!_isBomb;	//!!_option.isBomb;	//!!_isbomb;
	this.altstatus = 0;

	this.arrounds = []; //周囲8マスぶん（※角とかは3つになったりする）
	this.arround_bombs = 0;//周囲8マスに設置されている地雷の総数
	this.open = false;
}
/**
 * 
 * @param {*} _mode 
 */
MineCell.prototype.ViewOpen = function (){
	this.$e.removeClass("mine-hide").addClass("mine-open");

	var $p = this.$e.find('p');
	$p.removeClass("splite-flag splite-question splite-bomb");

	//爆発
	if(this.bomb){
		$p.addClass("splite-bomb");
		$p.css("background-size", this.FieldObj.CellSize + "px");
	}
	else if(this.arround_bombs > 0){
		$p.addClass("splite-num").css("background-position-x", -(this.arround_bombs * this.FieldObj.CellSize) + "px");
		$p.css("background-size", (this.FieldObj.CellSize * 10) + "px");
	}

	return $p;
};

/**
 * 爆弾マスのクリックイベント
 */
MineCell.prototype.Dig = function (){
	if(this.open){ return; }
	this.open = true;

	var $p = this.ViewOpen();

	//爆発
	if(this.bomb){
		$p.css("background-color", "#d02020");
		this.FieldObj.gameover();
	}
	//セーフ
	//周囲に爆弾が無いセルの場合は再帰して周囲を全部開く
	else if(this.arround_bombs === 0){
		for(var i=0; i < this.arrounds.length; i++){
			this.arrounds[i].Dig();
		}
	}
};
/**
 * Ops調査用の再帰処理
 */
MineCell.prototype.SearchOps = function (){
};

/**
 * 爆弾マスの右クリックイベント
 */
MineCell.prototype.Alt = function (){
	if(this.open){ return; }

	var $p = this.$e.find('p');
	$p.removeClass("splite-flag splite-question");

	$p.css("background-size", this.FieldObj.CellSize + "px");

	switch(this.altstatus){
		case 0: 
			$p.addClass("splite-flag");
			break;
		case 1:
			$p.addClass("splite-question");
			break;
	}
	this.altstatus = (this.altstatus + 1) % 3;
};



//-----------------------------------------------------------------------
/**
 * 地雷原クラス
 * @constructor
 * @param {*} _option 
 */
function MineSweeper(_config){
	if(!(this instanceof MineSweeper)) { return null; }

	//パラメータをインスタンスのプロパティにぶっこむ
	$.extend(true, this, _config||{});

	///DOM要素作成
	var _selectdifficulty = function($sel){
		//var conf;
		var conf = MineSweeper.difficulty[$sel.val()];
		if(conf == null){ return; }

		var $w = $sel.siblings('input[name="f-width"]').prop("readonly", conf[4]);
		var $h = $sel.siblings('input[name="f-height"]').prop("readonly", conf[4]);
		var $m = $sel.siblings('input[name="f-mine"]').prop("readonly", conf[4]);
		if(conf[1] != null){ $w.val(conf[1]); }
		if(conf[2] != null){ $h.val(conf[2]); }
		if(conf[3] != null){ $m.val(conf[3]); }
		if(conf[4]){ this.Build(); }
	};

	var $sel_difficulty = $('<select name="difficulty">')
		.on("change", (function(_e){
			_selectdifficulty.call(this, $(_e.target));
		}).bind(this))
		.val(this.difficulty || "normal");
	for(var i=0; i < MineSweeper.difficulty.length; i++){
		$sel_difficulty.append($('<option value="'+ i +'">'+ MineSweeper.difficulty[i][0] +'</option>'));
	}
	var $conpane = $('<div class="conf-panel">')
	.append(
		$('<button name="fieldreset">').text("再セット")
		.on("click", (function(_e){ this.Build(); }).bind(this))
	)
	.append( $('<input type="number" min="1" class="fconf" name="f-width" placeholder="幅">') )
	.append( $('<input type="number" min="1" class="fconf" name="f-height" placeholder="高さ">') )
	.append( $('<input type="text" class="fconf" name="f-mine" placeholder="爆弾割合">') )
	.append( $sel_difficulty );

	var $table = $('<table class="mine-field"><tbody></tbody></table>')
	.on('contextmenu', function(_e){
		_e.stopPropagation();
		return false;
	});

	this.$rtime = $('<p class="mine-info-rtime">');
	this.$area = $('<div class="mine-sweeper">')
		.append($('<div class="mine-control-panel">').append($conpane))
		.append($('<div class="mine-field-wrapper">').append($table))
		.append($('<div class="mine-info-panel">')
			.append(this.$rtime)
			.append($('<p class="mine-info">'))
		);

	_selectdifficulty.call(this, $sel_difficulty);

	return this.$area
}
MineSweeper.difficulty = [
	["easy", 9, 9, 12.345, true],
	["normal", 16, 16, 15.625, true],
	["hard", 30, 16, 20.625, true],
	["expert", 48, 24, 22, true],
	["mania", 64, 48, 25.293, true],
	["custom", null, null, null, false]
];

MineSweeper.prototype.Build = function(){	//_option){
	var rnd = new Random(this.seed);

	this.width = parseInt(this.$area.find('input[name="f-width"]').val(), 10);
	this.height = parseInt(this.$area.find('input[name="f-height"]').val(), 10);
	var ratio = this.$area.find('input[name="f-mine"]').val();
	ratio = isNaN(ratio) ? 100 : parseFloat(ratio);

	//爆弾の総数を確定
	var fieldsize = this.width * this.height;
		//var ratio = rnd(3) - 1;
		//if(fieldsize <= 81){ ratio = 12 + ratio; }
		//else if(fieldsize <= 256){ ratio = 15 + ratio; }
		//else{ ratio = 20 + ratio; }
	this.total = Math.round((fieldsize * ratio) / 100);

	if(this.width > 32 || this.height > 32){//fieldsize > 480){
		this.CellSize = 12;
		this.$area.addClass("MiniMini");
	}
	else{
		this.CellSize = 20;
		this.$area.removeClass("MiniMini");
	}

	//セルの作成
	this.mines = [];
	for(var i=0; i < fieldsize; i++){
		var cell = new MineCell(this, i < this.total);
		cell.index = rnd();
		this.mines.push(cell);
	}
	//セルをシャッフル
	this.mines.sort(function(_a, _b){
		return _a.index < _b.index ? -1 : _a.index > _b.index ? 1 : 0;
	});

	//周囲の爆弾情報の取得とtdの配置
	var $tbody = this.$area.find("table.mine-field > tbody");
	$tbody.empty();
	for(var cell_y=0; cell_y < this.height; cell_y++){
		var $tr = $('<tr>');
		for(var cell_x=0; cell_x < this.width; cell_x++){
			var index = (cell_y * this.width) + cell_x;
			var cell = this.mines[index];
			//周囲の地雷情報を取得
			for(var i = 0; i < 9; i++){
				var _x = cell_x + (i % 3 - 1);
				var _y = cell_y + ((i / 3 & 3) - 1);
				if(_y < 0 || _y >= this.height || _x < 0 || _x >= this.width){ continue; }

				var m = this.mines[_y * this.width + _x];
				if(m == null || m.index === cell.index){ continue; }

				cell.arrounds.push(m);
				if(m.bomb){ cell.arround_bombs++; }
			}
			$tr.append(cell.$e);
		}
		$tbody.append($tr);
	}

	//Opsの調査
	for(var i=0; i < this.mines.length; i++){
		//this.mines[i].SearchOps();
	}


	//情報出力パネルの初期化
	if(this._interval_id){
		clearInterval(this._interval_id);
		this._interval_id = null;
	}
	this.$rtime.text("Rtime: 0.00");

	this.info = {
		Rtime: 0,
		Left: 0
	};
	this.refresh_info();
};
MineSweeper.prototype.gameover = function(){
	for(var i=0; i < this.mines.length; i++){
		//爆弾のマスだけ全部オープン
		if(this.mines[i].bomb){
			this.mines[i].ViewOpen();
		}
		//var $p = this.mines[i].ViewOpen();
		//if(!this.mines[i].bomb){ $p.css("opacity", "0.5"); }
	}

	if(this._interval_id){
		clearInterval(this._interval_id);
		this._interval_id = null;
	}
};
MineSweeper.prototype.gameclear = function(){
	if(this._interval_id){
		clearInterval(this._interval_id);
		this._interval_id = null;
	}
};
MineSweeper.prototype.ClearCheck = function(){
	for(var i=0; i < this.mines.length; i++){
		if(this.mines[i].bomb && !this.mines[i].open){
			return false;
		}
	}

	//★ここでクリアの処理
	this.gameclear();
	if(this.GameClearCallback){
		this.GameClearCallback();
	}
};
MineSweeper.prototype.gamestart = function(){
	this.info.StartTime = this.info.Rtime = Date.now();
	this._interval_id = setInterval((function(){
		this.refresh_time();
	}).bind(this), 10);
};
MineSweeper.prototype.refresh_time = function(){
	this.info.Rtime = Date.now();
	this.$rtime.text(
		"Rtime: " + ((this.info.Rtime - this.info.StartTime) / 1000).toFixed(2),
	);
};
MineSweeper.prototype.refresh_info = function(_init){
	this.$area.find("p.mine-info").text([
		"Left: " + this.info.Left,
		"bomb: " + this.total
	].join("\n"));
};

return MineSweeper;
})(window.jQuery);
