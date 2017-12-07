
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
 * 			rnd(1000) -> 0～999
 * 
 * 		インスタンスにする場合
 * 			var r1 = new rnd();				//タイプスタンプをシードにしたインスタンス
 * 			var r2 = new rnd([999]);	//999をシードにしたインスタンス
 * 
 * 		r1とr2は別々のシードを持つ乱数生成オブジェクト
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

	if(Random.fn == null){
		Random.fn = new Random();
	}
	else if(arg instanceof Array){
		Random.fn = new Random([arg]);
		return null;
	}
	return Random.fn(arg);
}

//■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
// マインスイーパー
//■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■

//-----------------------------------------------------------------------
//constやらprivateやらの定義

//10秒間待ってやる……ではなく、ゲーム中に経過時間の更新が10秒間行われないと、
//例外エラーとして扱って、ゲームが強制終了します。
//ブラウザのデバッガーツールとかでブレイクポイントをいれようとすると起きるよ（*￣∇￣）
var CONST_ILLEGAL_DELAY_MS = 100000;

//難易度テーブル
// [ "選択名", 幅, 高さ, 爆弾の割合, セルサイズの初期値 ]
var TABLE_DIFFICULTY = [
	["easy", 9, 9, 12.345, 20],
	["normal", 16, 16, 15.625, 20],
	["hard", 30, 16, 20.625, 18],
	["expert", 48, 24, 22.222, 16],
	["mania", 64, 48, 25.293, 16],
	["custom", null, null, null, null]
];

//================================================================
/**
 * 地雷原クラス
 * そのままコールすると何もせずnullが帰ります。
 * newして使います。
 * @constructor
 * @param {object} _config
 * @return {null|object} 
 * 	function MineSweeper のインスタンスではなく、DOM出力用のjQueryオブジェクトが返る。
 * 	本体のインスタンスはどこにも格納しない。ちょっとしたチート対策ｗ
 */
function MineSweeper(_config){
	if(!(this instanceof MineSweeper)) { return null; }

	//パラメータをインスタンスのプロパティにそのままぶっこむという暴挙
	$.extend(true, this, {
		Seed: null, //乱数シード
		Difficulty: "normal", //デフォルト難易度
		Question: true, //右クリックでクエスチョンマークを使用する
		illegal_delay_ms: CONST_ILLEGAL_DELAY_MS
	}, _config||{});


	///難易度選択のselect要素を作る
	var $sel_difficulty = $('<select name="difficulty">').on("change", (function(_e){
		this.SelectDifficulty($(_e.target).val());
	}).bind(this));
	for(var i=0; i < TABLE_DIFFICULTY.length; i++){
		var $opt = $('<option>'+ TABLE_DIFFICULTY[i][0] +'</option>');
		$sel_difficulty.append($opt);
	}
	$sel_difficulty.val(this.Difficulty || "normal");

	///セルの表示サイズ選択のselect要素を作る
	var $sel_cellsize = $('<select name="cellsize">').on("change", (function(_e){
		this.Resize(parseInt($(_e.target).val(), 10));
	}).bind(this));
	for(var i=8; i <= 24; i++){
		$sel_cellsize.append($('<option value="'+ i +'">'+ i +'px</option>'));
	}
	$sel_cellsize.val(this.CellSize || 20);

	///幅の入力ボックス
	var $width = $('<input type="number" min="1" class="fconf" name="f-width" placeholder="幅">');
	///高さの入力ボックス
	var $height = $('<input type="number" min="1" class="fconf" name="f-height" placeholder="高さ">');
	///爆弾割合の入力ボックス
	var $ratio = $('<input type="text" class="fconf" name="f-mine" placeholder="爆弾割合">');

	///設定用のブロックを作って出力
	var $conpane = $('<div class="conf-panel">')
		.append(
			$('<button name="fieldreset">').text("リスタート")
			.on("click", (function(_e){ this.Build(); }).bind(this))
		)
		.append( $width )
		.append( $height )
		.append( $ratio )
		.append( $sel_cellsize )
		.append( $sel_difficulty );


	///地雷原となるtable要素です
	///右クリックでコンテキストメニューが出るのを抑止
	var $table = $('<table class="mine-field"><tbody></tbody></table>')
	.on('contextmenu', function(_e){
		_e.stopPropagation();
		return false;
	});

	///プレイ中の情報出力用要素
	///経過時間のカウンタを出力する要素はいちおう高速化のため、プロパティに入れて捕捉しておく
	this.$rtime = $('<p class="mine-rtime">'); //経過時間（装飾ありの要素）
	this.$rtimeinfo = $('<p class="mine-info-rtime">'); //経過時間を使って算出される情報の出力先

	///ここまで作った要素を組み立て
	this.$area = $('<div class="mine-sweeper">')
		.append($('<div class="mine-control-panel">').append($conpane))
		.append($('<div class="mine-field-wrapper">').append($table))
		.append($('<div class="mine-info-panel">')
			.append($('<div class="mine-info-panel-decoraterow">')
				.append(this.$rtime)
				.append($('<p class="mine-rest">'))
			)
			.append($('<p class="mine-result">'))
			.append(this.$rtimeinfo)
			.append($('<p class="mine-info">'))
		);

	///初期設定がカスタムの場合はそれぞれ初期値を入れて初期構築
	if(this.Difficulty === "custom"){
		if(this.Width != null && !isNaN(this.Width)){ $width.val(this.Width || 9); }
		if(this.Height != null && !isNaN(this.Height)){ $height.val(this.Height || 9); }
		if(this.Ratio != null && !isNaN(this.Ratio)){ $ratio.val(this.Ratio || 12); }
		this.Build();
	}
	///custom以外はそれぞれの難易度に初期値として指定されている入力値で地雷原を初期構築
	else {
		this.SelectDifficulty($sel_difficulty.val());
	}


//debug:これはデバッグモード
window.ms = this;

	///出力用の最上位要素を返す
	return this.$area
}

/**
 * 難易度選択の実行
 * @param {string} _key 難易度名
 */
MineSweeper.prototype.SelectDifficulty = function(_key){
	var conf;
	for(var i=0; i < TABLE_DIFFICULTY.length && conf == null; i++){
		if(TABLE_DIFFICULTY[i][0] === _key){ conf = TABLE_DIFFICULTY[i]; }
	}
	if(conf == null){ return; }

	//難易度テーブルを設定入力欄に適用
	var isReadOnly = (conf[1] && conf[2] && conf[3]);
	var $w = this.$area.find('input[name="f-width"]').prop("readonly", isReadOnly);
	var $h = this.$area.find('input[name="f-height"]').prop("readonly", isReadOnly);
	var $m = this.$area.find('input[name="f-mine"]').prop("readonly", isReadOnly);
	if(conf[1] != null){ $w.val(conf[1] || 2); }
	if(conf[2] != null){ $h.val(conf[2] || 2); }
	if(conf[3] != null){ $m.val(conf[3] || 16); }
	if(conf[4] != null){ this.$area.find('select[name="cellsize"]').val(conf[4] || 20); }

	//custom以外はパラメータ確定なので構築開始しちゃいます
	if(isReadOnly){ this.Build(); }
};

/**
 * 地雷原の作成
 */
MineSweeper.prototype.Build = function(){
	var rnd = new Random(typeof this.Seed === "number" ? [this.Seed] : null);

	//プレイ結果を初期化
	this.Result = null;

	//セルサイズを入力欄からもってくる
	this.CellSize = parseInt(this.$area.find('select[name="cellsize"]').val(), 10) || 20;

	//地雷原のサイズと爆弾比率を入力欄からもってきて最低値など補正
	this.width = parseInt(this.$area.find('input[name="f-width"]').val(), 10);
	if(isNaN(this.width) || this.width < 1){ this.width = 1; }
	this.height = parseInt(this.$area.find('input[name="f-height"]').val(), 10);
	if(isNaN(this.height) || this.height < 1){ this.height = 1; }
	var ratio = this.$area.find('input[name="f-mine"]').val();
	ratio = (isNaN(ratio) || ratio <= 0) ? 24 : parseFloat(ratio);
	var fieldsize = this.width * this.height;

	//爆弾の総数を確定させる。0個にはしない。
	this.BombTotal = Math.round((fieldsize * ratio) / 100);
	if(this.BombTotal <= 0){ this.BombTotal = 1; }

	//セルの作成
	this.cells = []; //全セルのキャッシュ先配列
	var idlist = []; //セルidのコンフリクト回避用
	for(var i=0; i < fieldsize; i++){
		//セル作成。爆弾総数まで、爆弾flagがtrue
		//このオブジェクトはDOM出力時のtd要素を持っています
		var cell = new MineCell(this, i < this.BombTotal);
		do{
			cell.id = rnd(); //idはランダムに割り当ててシャッフルに使う
		}while(idlist.indexOf(cell.id) !== -1);
		this.cells.push(cell);
	}
	//ランダムに割り当てたidでソートすると、セル配列の先頭に固まってた爆弾セルがシャッフルされます
	this.cells.sort(function(_a, _b){ return _a.id < _b.id ? -1 : _a.id > _b.id ? 1 : 0; });

	//周囲の爆弾情報の取得とtdの配置
	//一次元配列のセルを二次元配列（※table要素）に並べます
	var $tbody = this.$area.find("table.mine-field > tbody");
	$tbody.empty();
	for(var cell_y=0, cell_index=0; cell_y < this.height; cell_y++){
		var $tr = $('<tr>');
		for(var cell_x=0; cell_x < this.width; cell_x++, cell_index++){
			var cell = this.cells[cell_index];

			//周囲の地雷情報を取得
			for(var arround_i = 0; arround_i < 9; arround_i++){
				//4番目はセルは中心（自分）なので除外
				if(arround_i === 4){ continue; }

				//地雷原からはみ出さない範囲で周囲の座標を指定
				var _x = cell_x + (arround_i % 3 - 1);
				var _y = cell_y + ((arround_i / 3 & 3) - 1);
				if(_y < 0 || _y >= this.height || _x < 0 || _x >= this.width){ continue; }

				//周囲のセルを中心のセルから参照できるようにしておく
				//爆弾の総数もここでカウント
				var m = this.cells[_y * this.width + _x];
				if(m==null){ continue; }
				cell.arrounds.push(m);
				if(m.bomb){ cell.arround_bombs++; }
			}
			//cell.$eはセルのtd要素
			$tr.append(cell.$e);
		}
		$tbody.append($tr);
	}

	//---------------------------------------------------------
	//プレイ情報関連
	this.info = {
		StartTime: 0,
		PastTime: 0,
		Rtime: 0,
		Left: 0,
		Right: 0,
		Flags: 0,
		OOps: 0,
		Ops: 0,
		ThreeBV: 0,
		SolvedThreeBV: 0,
		BombTotal: this.BombTotal
	};

	//Opsの調査
	var OpsGrouping = function(_counter){
		if(!cell.bomb && this.arround_bombs === 0 && this.ops == null){
			this.ops = _counter;
			for(var i=0; i < this.arrounds.length; i++){
				OpsGrouping.call(this.arrounds[i], _counter);
			}
		}
	};
	for(var i=0, counter=1; i < this.cells.length; i++){
		var cell = this.cells[i];
		if(!cell.bomb && cell.arround_bombs === 0 && cell.ops == null){
			OpsGrouping.call(cell, counter);
			counter++;
		}
	}
	this.info.Ops = counter - 1;

	//3BVの調査
	for(var i=0; i < this.cells.length; i++){
		var cell = this.cells[i];
		if(cell.ops != null){
			cell.bv = true;
			for(var j=0; j < cell.arrounds.length; j++){
				cell.arrounds[j].bv = true;
			}
		}
	}
	this.info.ThreeBV = this.info.Ops;
	for(var i=0; i < this.cells.length; i++){
		if(!this.cells[i].bomb && this.cells[i].bv == null){
			this.info.ThreeBV++;
		}
	}

	//情報出力パネルの初期化
	if(this._interval_id){
		clearInterval(this._interval_id);
		this._interval_id = null;
	}
	this.$rtime.text("000.00");
	this.$rtimeinfo.text("");
	this.$area.find("p.mine-result").removeClass("clear fail illegal").text("");

	this.refresh_info();
};

/**
 * セルのリサイズを実行する。正方形のみ。
 * @param {number} _size ピクセル指定のセルサイズ
 */
MineSweeper.prototype.Resize = function(_size){
	this.CellSize = _size;
	for(var i=0; i < this.cells.length; i++){
		this.cells[i].ViewResize();
	}
};

/**
 * クリア失敗したときの終了処理
 */
MineSweeper.prototype.gameover = function(){
	//経過時間カウンタの停止
	if(this._interval_id){
		clearInterval(this._interval_id);
		this._interval_id = null;
	}

	//爆弾のマスだけ全部表示
	for(var i=0; i < this.cells.length; i++){
		if(this.cells[i].bomb){ this.cells[i].ViewOpen(); }
		this.cells[i].open = true;
	}

	//結果の画面出力
	this.Result = "exlposion";
	this.$area.find("p.mine-result").addClass("fail").text("Explosion!");

	//終了時のコールバック実行
	if(this.FinishCallback){ this.FinishCallback(this.info); }
};

/**
 * クリア成功したときの終了処理
 */
MineSweeper.prototype.gameclear = function(){
	//経過時間カウンタの停止
	if(this._interval_id){
		clearInterval(this._interval_id);
		this._interval_id = null;
	}

	//結果の画面出力
	this.Result = "success";
	this.$area.find("p.mine-result").addClass("clear").text("Success!");

	//終了時のコールバック実行
	if(this.FinishCallback){ this.FinishCallback(this.info); }
};

/**
 * 例外停止したときの終了処理
 */
MineSweeper.prototype.illegal = function(){
	//経過時間カウンタの停止
	if(this._interval_id){
		clearInterval(this._interval_id);
		this._interval_id = null;
	}

	//結果の画面出力
	this.Result = "illegal";
	this.$area.find("p.mine-result").addClass("illegal").text("illegal stop");
};

/**
 * ゲーム終了の判定と、終了したときの処理の呼び出し
 */
MineSweeper.prototype.ResultCheck = function(){
	var danger = false;
	for(var i=0; i < this.cells.length; i++){
		if(this.cells[i].bomb && this.cells[i].open) {
			this.gameover();
			return;
		}
		else if(!this.cells[i].bomb && !this.cells[i].open){
			danger = true;
		}
	}
	if(!danger){
		this.gameclear();
	}
};

/**
 * ゲーム開始（経過時間のカウント開始）
 */
MineSweeper.prototype.gamestart = function(){
	this.info.StartTime = this.info.PastTime = Date.now();
	this._interval_id = setInterval((function(){
		this.refresh_time();
	}).bind(this), 10);
};

/**
 * プレイ情報の画面出力
 * この関数では経過時間に関連する情報のみを更新する。
 * 10msごとに自動実行
 */
MineSweeper.prototype.refresh_time = function(){
	var past = Date.now();
	//一定時間以上スクリプトが停止したら終了
	if((this.info.PastTime + this.illegal_delay_ms) < past){
		this.illegal();
		return;
	}
	this.info.PastTime = past;
	var rtime = ((this.info.PastTime - this.info.StartTime) / 1000).toFixed(2);
	this.info.Rtime = parseFloat(rtime);
	this.info.RtimeDisp = this.info.Rtime < 1000 ? ("000" + rtime).slice(-6) : rtime;
	this.$rtime.text(this.info.RtimeDisp);

	var bvs = !this.info.Rtime ? 0 : ((this.info.SolvedThreeBV || 1) / this.info.Rtime);
	var est = !bvs ? 0 : (this.info.ThreeBV / bvs);
	//this.info.Rtime + (this.info.ThreeBV / this.info.SolvedThreeBV * bvs);
	this.$rtimeinfo.text(
		"Est RTime: " + est.toFixed(2) + "\n" +
		"3BV/s: " + bvs.toFixed(2)
	);
};

/**
 * プレイ情報の画面出力
 * クリック時に実行される
 */
MineSweeper.prototype.refresh_info = function(){
	var bombrest = this.info.BombTotal - this.info.Flags;
	this.$area.find("p.mine-rest").text(bombrest < 0 ? 0 : bombrest);
	this.$area.find("p.mine-info").text([
		"Left: " + this.info.Left,
		"Right: " + this.info.Right,
		"BombTotal: " + this.info.BombTotal,
		"Flags: " + this.info.Flags,
		"3BV: " + (this.info.SolvedThreeBV + "/" + this.info.ThreeBV),
		"Ops: " + (this.info.OOps + "/" + this.info.Ops)
	].join("\n"));
};









//================================================================
/**
 * 地雷原フィールドセルクラス
 * @param {*} _FieldObj MineSweeperオブジェクト
 * @param {*} _isBomb 爆弾かそうでないか
 */
function MineCell(_FieldObj, _isBomb){
	if(!(this instanceof MineCell)) { return; }
	this.Field = _FieldObj;

	var size_style = this.Field.CellSize + "px";

	//DOM要素作成
	this.$e = $('<td class="mine mine-hide">')
		.css({ "min-width": size_style, "width": size_style, "height": size_style})
		.append($('<p>').css({ "width": size_style, "height": size_style }))
		.on("click", (function(_e){
			if(this.Field.Result == null && !this.open){
				if(this.Field._interval_id == null){
					this.Field.gamestart();
				}

				//info関連
				this.Field.info.Left++;
				if(!this.bomb){
					if(this.arround_bombs === 0){
						this.Field.info.OOps++;
					}
					if(this.bv == null || (this.bv && this.arround_bombs === 0)){
						this.Field.info.SolvedThreeBV++;
					}
				}

				this.Dig();

				this.Field.refresh_info();
				this.Field.ResultCheck();
			}
		}.bind(this)))
		.on("contextmenu", this.Alt.bind(this));


	this.bomb = !!_isBomb;	//!!_option.isBomb;	//!!_isbomb;
	this.altstatus = 0;

	this.arrounds = []; //周囲8マスぶん（※角とかは3つになったりする）
	this.arround_bombs = 0;//周囲8マスに設置されている地雷の総数
	this.open = false;
}

/**
 * セルのデータと状態に合わせて、画像を出力
 * @return {object} 画像表示しているp要素のjQueryオブジェクトを返す
 */
MineCell.prototype.ViewOpen = function (){
	this.$e.removeClass("mine-hide").addClass("mine-open");

	var $p = this.$e.find('p');
	$p.removeClass("splite-flag splite-question splite-bomb");

	//爆発
	if(this.bomb){
		$p.addClass("splite-bomb");
		$p.css("background-size", this.Field.CellSize + "px " + this.Field.CellSize + "px");
	}
	else if(this.arround_bombs > 0){
		$p.addClass("splite-num").css("background-position-x", -(this.arround_bombs * this.Field.CellSize) + "px");
		$p.css("background-size", (this.Field.CellSize * 10) + "px " + this.Field.CellSize + "px");
	}

	return $p;
};

/**
 * セル表示サイズを変更を行う。
 * サイズの指定はMineSweeperオブジェクトを参照。
 */
MineCell.prototype.ViewResize = function (){
	var cellsize = this.Field.CellSize; //セルの大きさ

	//this.$eはtd要素
	this.$e.css({
		"min-width": cellsize + "px",
		"width": cellsize + "px",
		"height": cellsize + "px"
	});

	//セルに周囲の爆弾数が表示されている状態の場合
	if(this.open && !this.bomb && this.arround_bombs > 0){
		// this.$e.find('p') は画像を表示している要素
		this.$e.find('p').css({
			"width": cellsize + "px",
			"height": cellsize + "px",

			//  200px * 20px の画像をセルの大きさに合わせたサイズに拡縮
			"background-size": (cellsize * 10) + "px " + cellsize + "px",

			//  表示したい数字になるようbackground-position-xを指定
			//  this.arround_bombs は周囲8マスに配置されている爆弾の総数
			"background-position-x": -(this.arround_bombs * cellsize) + "px"
		});
	}
	//
	else{
		this.$e.find('p').css({
			"width": cellsize + "px",
			"height": cellsize + "px",
			"background-position-x": "0px",
			"background-size": cellsize + "px " + cellsize + "px"
		});
	}
};

/**
 * 爆弾マスのクリックイベント
 * セルを左クリックしたときと、周囲に爆弾0のセルをクリックしたときに周囲8マスで再帰呼び出しされる。
 */
MineCell.prototype.Dig = function (){
	if(this.open){ return; }
	this.open = true;

	var $p = this.ViewOpen();

	//爆発
	if(this.bomb){
		$p.css("background-color", "#d02020");
	}
	//セーフ
	//周囲に爆弾が無いセルの場合は再帰して周囲を全部開く
	else if(this.arround_bombs === 0){
		for(var i=0; i < this.arrounds.length; i++){ this.arrounds[i].Dig(); }
	}
};

/**
 * 爆弾マスの右クリックイベント
 * 　通常（画像なし） → 旗 → はてなマーク → （最初へもどる）
 * のループで表示画像を変更する。
 */
MineCell.prototype.Alt = function (){
	if(this.open || this.Field.Result != null){ return; }
	this.Field.info.Right++;

	//var altclass = this.Field.Question ? ["", "splite-flag", "splite-question", ""] : ["splite-flag", ""];
	var altclass = ["", "splite-flag"];
	var flag_index = 1;
	if(this.Field.Question){ altclass.push("splite-question"); }

	//ステータスインクリメントの前に旗が立ってた場合は、先に旗総数を減らす
	if(this.altstatus === flag_index){ this.Field.info.Flags--; }
	
	this.altstatus = (this.altstatus + 1) % altclass.length;
	
	//ステータスインクリメントの後に旗が立ってた場合は、先に旗総数を増やす
	if(this.altstatus === flag_index){ this.Field.info.Flags++; }

	this.$e.find('p')
		.removeClass(altclass.join(" "))
		.css("background-size", this.Field.CellSize + "px")
		.addClass(altclass[this.altstatus]);

	this.Field.refresh_info();

	/*
		var $p = this.$e.find('p');
		$p.removeClass(altclass.join(" "));
		$p.css("background-size", this.Field.CellSize + "px");
		$p.addClass(altclass[this.altstatus] || "");
		this.altstatus = (this.altstatus + 1) % altclass.length;


		//旗の場合
		if(this.altstatus === 1){ this.Field.info.Flags++; }
		else if(this.altstatus === (2 % altclass.length)){ this.Field.info.Flags--; }


		this.Field.refresh_info();
	*/
};




return MineSweeper;
})(window.jQuery);
