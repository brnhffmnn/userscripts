// ==UserScript==
// @name DB Kreditkarte QIF
// @namespace http://slowpoke.de/
// @description Fügt dem BahnCard Kreditkartenbankings unter https://www.kreditkartenbanking.de/bahncard eine Exportfunktion für das QIF Format hinzu.
// @version 1.0.0
// @downloadURL https://github.com/panzerfahrer/userscripts/raw/master/db-kreditkarte-qif/db-kreditkarte_qif.user.js
// @updateURL https://github.com/panzerfahrer/userscripts/raw/master/db-kreditkarte-wiso-qif/update.user.js
// @include https://www.kreditkartenbanking.de/bahncard/cos_std/dispatch.do*
// @run-at document-end
// @grant none
// @require https://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js
// @require https://github.com/panzerfahrer/userscripts/raw/master/db-kreditkarte-qif/filesaver/FileSaver.min.js
// @require https://github.com/panzerfahrer/userscripts/raw/master/db-kreditkarte-qif/blob/Blob.js
// ==/UserScript==

/*
   Copyright 2014 Brian Hoffmann, slowpoke.de

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

var debug = false;

var entriesTab = $("html body div.pageLayer table tbody tr td.contentColumn div table tbody tr td.tabName table + table tbody");
if(debug) console.log(entriesTab.children());

if(entriesTab.length > 0 && entriesTab.children("form").length == 0){
	useFullWidth();
	transform();
	setupExport();
}

function setupExport(){
	var footer = $("#StatementContent > table > tbody > tr:nth-child(2) > td > table:nth-child(2) > tbody > tr:last-child > td.tabdataRight");
	var exportEl = $("<p>Export: </p>");
	var exportQif = $('<a class="button">QIF</a>');
	
	exportQif.click(function(){
		exportQIF();
	});
	
	exportEl.append(exportQif);
	footer.append(exportEl);
}

function exportQIF(){
	var qif = ["!Type:CCard\n"];
	
	entriesTab.children("tr").each(function(idx){
		if(isData($(this)) && $(this).children().length > 1){
			qif[qif.length] = "D" + $(this).children(":nth-child(1)").text() + "\n";
			qif[qif.length] = "P" + $(this).children(":nth-child(3)").text() + " " + $(this).children(":nth-child(4)").text() + "\n";
			qif[qif.length] = "T" + $(this).children(":nth-child(5)").text() + "\n";
			qif[qif.length] = "^\n";
		}
	});
	
	var blob = new Blob(qif, {type: "text/plain;charset=ascii"});
	var title = $("#StatementContent > table > tbody > tr:nth-child(2) > td > table:nth-child(1) > tbody > tr:nth-child(2) > td > h2").text();
	title = title.replace(/[\s\t-]{2,}/g, " ").trim();
	saveAs(blob, title + ".txt");
}

function transform(){
	if(debug) console.log("transform");

	// set uids to rows
	entriesTab.children("tr").each(function(idx){
		$(this).data("uid", Math.random().toString(36).substr(2,9));
	});

	entriesTab.children().filter(function(filterIdx){
			return filterIdx <= 4 && $(this).children().first().hasClass("tabtext") && $(this).children().first().attr("colspan") == 2;
		}).each(function(idx){
			if($(this).children().length == 3){
				t1 = $(this).children(":nth-child(2)").text();
				$(this).children(":nth-child(2)").empty();
				$(this).children(":nth-child(2)").text($.trim(t1));
				$(this).children(":nth-child(2)").prepend($.trim($(this).children(":nth-child(3)").text()));
				$(this).children(":nth-child(3)").remove();
			}
			
			$(this).children().first().attr("colspan", 3);
			$(this).children().last().attr("colspan", 2);
			$(this).children().last().css("text-align", "right");
		}
	);
	
	entriesTab.children().filter(function(filterIdx){
			return isHeader($(this));
		}).each(function(idx){
			try {
				if(debug) console.log(" header #" + idx);
				if(isHeader($(this).prev())){
					mergeHeader($(this).prev(), $(this));
				}
			} catch(e){
				if(debug) console.log(e);	
			}
		}
	);
	
	entriesTab.children("tr").filter(function(filterIdx){
			try {
				if(debug) console.log("  datafilter #" + filterIdx, this);
				return $(this).children().length > 1 && $(this).children(".tabtext").length == 0 &&
					   ((isHeader($(this).prev()) && filterIdx % 2 == 0) ||
					    (isData($(this)) && filterIdx % 2 == 1));
			} catch(e){
				if(debug) console.log(e);
			}
		}).each(function(idx){
			try {
				if(debug) console.log(" data #" + idx);
				if(canMergeData($(this), $(this).next())){
					mergeData($(this), $(this).next());
				} else if(canMergeData($(this).prev(), $(this)))  {
					mergeData($(this).prev(), $(this));
				} else {
					if(debug) console.log(" data no match: prev", $(this).prev(), " this", $(this), " next", $(this).next());
				}
			} catch(e){
				if(debug) console.log(e);	
			}
		}
	);
	
	// remove seperator and header in middle of table
	var sepSection = entriesTab.children("tr").filter(function(filterIdx){
		return $(this).children().length == 1 &&
			   $(this).children().first().hasClass("tabdata") &&
			   $(this).children().first().children("h3").length == 1;
	});
	
	if(sepSection.length > 0 && sepSection.data("uid") != entriesTab.children(":nth-child(6)").data("uid")){
		sepSection.prev().remove();
		sepSection.next().remove();
		
		if(!isHeader(entriesTab.children(":nth-child(2)")) && 
		   !isHeader(entriesTab.children(":nth-child(5)")) &&
		   isHeader(entriesTab.children(":nth-child(6)"))){
			entriesTab.children(":nth-child(6)").before(sepSection);
		} else {
			entriesTab.children().first().after(sepSection);
		}
	}
	
	// remove clutter at end of table
	if(isSeperator(entriesTab.children("tr").last())){
		entriesTab.children("tr").last().remove();
	}
	
	// reassign altering row style
	var tabCur = entriesTab.children("tr.tabhead + tr");
	var tabIdx = 0;
	while( !(typeof tabCurUID === "undefined" || tabCurUID == null) ){
		if(debug) console.log("reformat", tabCur);
		
		if(tabIdx % 2 == 0){
			tabCur.removeClass("tabdata2").addClass("tabdata");
		} else {
			tabCur.removeClass("tabdata").addClass("tabdata2");
		}
		
		tabIdx++;
		tabCur = tabCur.next();
	}
	
	entriesTab.children("tr").last().prev().removeClass("tabdata").removeClass("tabdata2");
	entriesTab.children("tr").last().removeClass("tabdata").removeClass("tabdata2");
}

function useFullWidth(){
	if(debug) console.log("fullWidth");
	try {
		$("html body div.pageLayer table").attr("width", "100%");
		//$("html body div.pageLayer table").css("width", "100%");
		$("html body div.pageLayer table tbody tr td.contentColumn").css("width", "auto");
	} catch(e){
		if(debug) console.log(e);	
	}
}

function isSeperator($el){
	return !isData($el) && !isHeader($el) && $el.children().length == 1 && $el.children().first().attr("colspan") == 4;
}

function isHeader($el){
	result = $el.children(".tabdata").length == 0 && $el.children(".tabtext").length == 0 && ($el.hasClass("tabhead") || $el.children(".tabhead").length == 3);
	if(result) if(debug) console.log(" isHeader", $el);
	return result;
}

function isData($el){
	return $el.hasClass("tabdata") || $el.hasClass("tabdata2");	
}

function mergeHeader($first, $second){
	if(debug) console.log("  mergeHeader", $first, $second);

	try {
		$first.children().last().removeAttr("colspan");
		$second.children().last().remove();
		
		$first.addClass("tabhead");
		$first.append($second.children());
		$second.remove();
		
		$first.children(":nth-child(1)").after($first.children(":nth-child(4)"));
		$first.children(":nth-child(3)").after($first.children(":nth-child(5)"));
		
	} catch(e){
		if(debug) console.log(e);	
	}
}

function canMergeData($first, $second){
	return (isData($first) && isData($second)) && (
				($first.hasClass("tabdata") && $second.hasClass("tabdata")) ||
				($first.hasClass("tabdata2") && $second.hasClass("tabdata2"))
		   );
}

function mergeData($first, $second){
	if(debug) console.log("  mergeData", $first, $second);
	
	try {
		$first.children(":nth-child(3)").text(minText($first.children(":nth-child(3)").text()));
		$first.children(":nth-child(3)").prepend(minText($first.children(":nth-child(4)").text()));
		$first.children(":nth-child(4)").remove();
		
		$second.children().last().remove();
		$second.children().last().remove();
		
		$first.append($second.children());
		$second.remove();
		
		$first.children(":nth-child(1)").after($first.children(":nth-child(4)"));
		$first.children(":nth-child(3)").after($first.children(":nth-child(5)"));
		
		$first.children().each(function(idx){
			$(this).text(minText($(this).text()));
		});
		
		$first.children().css("text-align", "left");
		$first.children().last().css({"text-align": "right", "padding-right": "8px"});
	} catch(e){
		if(debug) console.log(e);	
	}
}

function minText(text){
	return text.replace(/[\r\n]/g, "")
               .replace(/[\s\t]{2,}/g, " ")
               .replace(/^\s+|\s+$/g, "")
			   .replace(/^- /, "-");
}