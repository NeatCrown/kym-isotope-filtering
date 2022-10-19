// ==UserScript==
// @name         Isotope Filtering
// @version      1.0
// @description  Achieve filtering by replacing masonry with isotope
// @author       e
// @match        https://knowyourmeme.com/*photos*
// @match        https://knowyourmeme.com/memes/*
// @match        https://knowyourmeme.com/users/*
// @match        https://knowyourmeme.com/search*
// @exclude      https://knowyourmeme.com/users/*/photos
// @run-at       document-end
// @grant        GM_setValue
// @grant        GM_getValue
// @noframes
// ==/UserScript==
/* globals jQuery, $ */

var entryFilter = GM_getValue('entryFilter', '');
var userFilter = GM_getValue('userFilter', '');
var filterSwitch = GM_getValue('filterSwitch', true);
var filterNsfw = GM_getValue('filterNsfw', false);
var filterSpoilers = GM_getValue('filterSpoilers', false);
var unveilNsfw = GM_getValue('unveilNsfw', false);
var unveilSpoilers = GM_getValue('unveilSpoilers', false);
const U = 'Uploaded by';
var isNotEntry = !$('#section_header h1').find('a').length;
var $p = $('#photo_gallery');
console.log(entryFilter);
console.log(userFilter);

function filterPictures(laidOutItems) {
    $(laidOutItems).each( function() {
        var element = this.element ? $(this.element) : $(this);
        if (element.hasClass('item')) {
            var item = element.find('a');
            var entry = entryFromItem(item)
            var user = userFromItem(item)

            if (entry) {
                if (entryFilter.indexOf('|' + entry + '|') >= 0 && isNotEntry ||
                    userFilter.indexOf('|' + user + '|') >= 0)
                {
                    this.classList.add("filtered");
                } else {
                    this.classList.remove("filtered");
                }
            }
        }
    });
}

function entryFromItem(item) {
    return item.attr('href').replace(/^[^-]*-/, '');
}

function userFromItem(item) {
    var user = item.find('.c').text();
    return user.slice(user.indexOf(U) + U.length).trim().replace(/\n/g, ' ');
}

function updateFilter() {
    if (filterSwitch) {
        $p.isotope({ filter: ':not(.filtered)' + (filterNsfw ? ':not(:has(a > .img-nsfw))' : '')
                    + (filterSpoilers ? ':not(:has(a > .img-spoiler))' : '')});
    } else {
        $p.isotope({ filter: '*' });
    }
}

$.fn.customUnveil = function() {
    $(this).each( function() {
        var imgClasses = this.classList;
        var isNsfw = imgClasses.contains('img-nsfw');
        var isSpoiler = imgClasses.contains('img-spoiler');

        if ((isNsfw && unveilNsfw) || (isSpoiler && unveilSpoilers)) {
            this.src = this.getAttribute('data-original-image-url');
            this.height = this.getAttribute('data-original-height');
        } else {
            this.src = this.getAttribute('data-src');
        }
    });
}

function setupIsotope() {
    $p.masonry('destroy');

    $p.isotope({
        // options
        itemSelector: '.item',
        // nicer reveal transition
        visibleStyle: { transform: 'translateY(0)', opacity: 1 },
        hiddenStyle: { transform: 'translateY(100px)', opacity: 0 },
    });
    return $p.data('isotope');
}

function setupInfScroll(iso) {
    const nextPage = '#infinite-scroll-wrapper .next_page';
    // don't change the inf scrolling if gallery has no other pages
    if (!$(nextPage).length) return;

    $p.infiniteScroll('destroy');
    $p.off('append.infiniteScroll');
    $p.off('last.infiniteScroll');
    $p.infiniteScroll({
        path: nextPage,
        append: '#infinite-scroll-wrapper .item',
        scrollThreshold: 30,
        outlayer: iso,
        status: '#page-load-status',
        history: false,
    });

    $p.on( 'append.infiniteScroll', function( event, response, path, items ) {
        // terminate infinite scroll if we reached the end
        if (!items.length) {
            $p.infiniteScroll('destroy');
            $('#page-load-status, .infinite-scroll-last').show();
        }
        filterPictures(items);
        $(items).find('img').customUnveil();
        updateFilter();
    });
}

// workaround for loading js because @require doesn't work with @grant
function initAll() {
    var script = document.createElement('script');
    script.onload = function () {
        var iso = setupIsotope();
        setupInfScroll(iso);
        // first filtering for items that were already loaded
        var firstItems = iso.getItemElements();
        filterPictures(firstItems);
        var firstImages = $(firstItems).find('img')
        firstImages.off("unveil");
        firstImages.customUnveil();
        updateFilter();
    };
    script.src = "https://unpkg.com/isotope-layout@3/dist/isotope.pkgd.min.js";
    document.head.appendChild(script);

    var pageStatus = `
        <div id="page-load-status" style="display: none;">
          <div id="infscr-loading" class="infinite-scroll-request">
            <img alt="Loading..." src="https://s.kym-cdn.com/assets/nyan-loader-1e8a60aa470ba72bc1ade31dcc2e150f.gif" style="display: block;"><em>Loading moar...</em>
          </div>
          <p class="infinite-scroll-last" style="text-align: center; font-size: 18px; margin-top: 20px;">No more content</p>
        </div>`;
    $p.after(pageStatus);

    // load colorbox on click
    $("body").off("photos-loaded", "#photo_gallery");
    $("#photo_gallery").on("click", "a.photo", function() {
        return $(this).colorbox({
            slideshow: false,
            slideshowSpeed: 5e3,
            href: $(this).data("colorbox-url"),
            current: "{current}|{total}",
            opacity: 1,
            scrolling: !1,
            transition: "none",
            onOpen: function() {
                return $("#colorbox").hide()
            },
            onComplete: function() {
                appendColorboxButtons($(this));
                return $("#colorbox").fadeIn(200),
                    parse_favorites(),
                    parse_thumbs(),
                    parsePins(),
                    unsafeWindow.photoColorboxed()
            },
            onClosed: function() {
                return unsafeWindow.photoColorboxed(!0)
            }
        })
    });
}

function appendMenu() {
    var overlay = `
        <style>
        .combo-wrapper, #ctoolbar, .ad-container {
            display:none !important;
        }
        .open-button {
          background-color: #555;
          color: white;
          padding: 16px 20px;
          border: none;
          cursor: pointer;
          opacity: 0.8;
          position: fixed;
          bottom: 23px;
          right: 28px;
          width: 300px;
          z-index: 8;
        }

        .form-popup {
          display: none;
          position: fixed;
          width: 300px;
          bottom: 0;
          right: 15px;
          border: 3px solid #f1f1f1;
          z-index: 9;
          padding: 10px;
          background-color: white;
        }

        .form-popup .btn {
          background-color: #4CAF50;
          color: white;
          padding: 16px 20px;
          border: none;
          cursor: pointer;
          width: 100%;
          margin-bottom:10px;
          opacity: 0.8;
        }

        .form-popup .btn::-moz-focus-inner {
           border: 0;
        }

        .form-popup .cancel {
          background-color: red;
        }

        .form-popup .btn:hover, .open-button:hover {
          opacity: 1;
        }

        .fthumb {
          display: flex;
          flex-direction: row;
          margin-bottom: 3px;
        }

        .finfo {
          background: rgba(0,0,0,0.75);
          padding: 11px 8px;
          width: 135px;
          font-size: 1.1em;
          line-height: 1.3em;
          color: #f0f0f0;
        }

        </style>

        <button id = "filter_open" class="open-button" onclick='document.getElementById("myForm").style.display = "block";'>Images Filtered</button>

        <div class="form-popup" id="myForm">
            <div id = "textarea_filters" style = "width: 100%; margin-top: 10px">
            <p id = "p_entry_filter" style = "text-align: center"><b>Entry filters</b></p>
            <textarea id = "entry_filter" rows="6" style="width: 100%; height: 100%; resize: none;"></textarea>
            <p id = "p_user_filter" style = "text-align: center"><b>User filters</b></p>
            <textarea id = "user_filter" rows="6" style="width: 100%; height: 100%; resize: none;"></textarea>
            <input id="cbox_filterswitch" type="checkbox" style="width: 16px; height: 16px; margin-bottom: 15px;">
            <label for="cbox_filterswitch" style="font-size: 14px;">Filter On/Off</label>
            <br>
            <input id="cbox_filternsfw" type="checkbox" style="width: 16px; height: 16px; margin-bottom: 15px;">
            <label for="cbox_filternsfw" style="font-size: 14px;">Filter NSFW</label>
            <input id="cbox_filterspoiler" type="checkbox" style="width: 16px; height: 16px; margin-bottom: 15px; margin-left: 15px">
            <label for="cbox_filterspoiler" style="font-size: 14px;">Filter spoilers</label>
            <hr>
            <input id="cbox_unveilnsfw" type="checkbox" style="width: 16px; height: 16px; margin-bottom: 15px;">
            <label for="cbox_unveilnsfw" style="font-size: 14px;">Unveil NSFW</label>
            <input id="cbox_unveilspoilers" type="checkbox" style="width: 16px; height: 16px; margin-bottom: 15px; margin-left: 8px">
            <label for="cbox_unveilspoilers" style="font-size: 14px;">Unveil spoilers</label>
            <button id = "save_filters" class="btn">✓ Save filters</button>
            </div>

            <button type="button" class="btn cancel" onclick='document.getElementById("myForm").style.display = "none";'>Close</button>
        </div>`;

    $('body').append(overlay);
    $('#entry_filter').val(entryFilter);
    $('#user_filter').val(userFilter);

    $('#save_filters').click(function() {
        entryFilter = $('#entry_filter').val()
        userFilter = $('#user_filter').val()
        GM_setValue('entryFilter', entryFilter);
        GM_setValue('userFilter', userFilter);
        globalFilterReload();
    });

    $('#cbox_filternsfw').prop("checked", filterNsfw);
    $('#cbox_filternsfw').change(function() {
        GM_setValue('filterNsfw', this.checked);
        filterNsfw = this.checked;
        updateFilter();
    });

    $('#cbox_filterspoiler').prop("checked", filterSpoilers);
    $('#cbox_filterspoiler').change(function() {
        GM_setValue('filterSpoilers', this.checked);
        filterSpoilers = this.checked;
        updateFilter();
    });

    $('#cbox_filterswitch').prop("checked", filterSwitch);
    $('#cbox_filterswitch').change(function() {
        GM_setValue('filterSwitch', this.checked);
        filterSwitch = this.checked;
        updateFilter();
    });

    $('#cbox_unveilnsfw').prop("checked", unveilNsfw);
    $('#cbox_unveilnsfw').change(function() {
        GM_setValue('unveilNsfw', this.checked);
        unveilNsfw = this.checked;
    });

    $('#cbox_unveilspoilers').prop("checked", unveilSpoilers);
    $('#cbox_unveilspoilers').change(function() {
        GM_setValue('unveilSpoilers', this.checked);
        unveilSpoilers = this.checked;
    });
}

if ($p.length) {
    initAll();
    appendMenu();
}

function globalFilterReload() {
    if ($p.data('isotope')) {
        $('#entry_filter').val(entryFilter);
        $('#user_filter').val(userFilter);
        var items = $p.data('isotope').getItemElements();
        filterPictures(items);
        updateFilter();
    }
}

const buttonStatus = {
    addEntry    : "Filter entry",
    removeEntry : "Unfilter entry",
    addUser     : "Filter user",
    removeUser  : "Unfilter user"
};

function entryBlockButton(entryToFilter) {
    // check if entry was filtered already
    var entryIndex = entryFilter.indexOf(entryToFilter);
    var entryIsFiltered = entryIndex >= 0;
    return $('<a/>', {
        'href': 'javascript:;',
        'class':'red button filterbtn',
        'text': entryIsFiltered ? buttonStatus.removeEntry : buttonStatus.addEntry
    }).on('click', function(){
        entryFilter = GM_getValue('entryFilter', '');
        entryIndex = entryFilter.indexOf(entryToFilter);
        if (entryIndex >= 0) {
            entryFilter = entryFilter.substr(0, entryIndex + 1) +
                          entryFilter.substr(entryIndex + entryToFilter.length);
            if (entryFilter.length == 1) entryFilter = '';
            $(this).text(buttonStatus.addEntry);
        } else {
            entryFilter += entryFilter.slice(-1) == '|' ? entryToFilter.substring(1) : entryToFilter;
            $(this).text(buttonStatus.removeEntry);
        }
        GM_setValue('entryFilter', entryFilter);
        globalFilterReload();
    });
}

function userBlockButton(userToFilter) {
    // check if user was filtered already
    var userIndex = userFilter.indexOf(userToFilter);
    var userIsFiltered = userIndex >= 0;
    return $('<a/>', {
        'href': 'javascript:;',
        'class':'red button filterbtn',
        'text': userIsFiltered ? buttonStatus.removeUser : buttonStatus.addUser
    }).on('click', function() {
        userFilter = GM_getValue('userFilter', '');
        userIndex = userFilter.indexOf(userToFilter);
        if (userIndex >= 0) {
            userFilter = userFilter.substr(0, userIndex + 1) +
                         userFilter.substr(userIndex + userToFilter.length);
            if (userFilter.length == 1) userFilter = '';
            $(this).text(buttonStatus.addUser);
        } else {
            userFilter += userFilter.slice(-1) == '|' ? userToFilter.substring(1) : userToFilter;
            $(this).text(buttonStatus.removeUser);
        }
        GM_setValue('userFilter', userFilter);
        globalFilterReload();
    });
}

// append a button to entry pages to switch the filter on/off
var entryHeader = $('#maru .rel.c');
if (entryHeader.length){
    var entryToFilter = '|' + /[^/]*$/.exec(window.location.href)[0] + '|';
    button = entryBlockButton(entryToFilter);
    button.css("margin-left", "10px");
    entryHeader.prepend(button);
}

// append a button to user pages as well
var userHeader = $('#profile_info');
if (userHeader.length) {
    var userToFilter = '|' + $('#profile_bio').find('h1').text() + '|';
    var button = userBlockButton(userToFilter);
    button.css("margin-left", "24px");
    userHeader.prepend(button);
}

// buttons on colorbox overlay
function appendColorboxButtons(item) {
    entryToFilter = '|' + entryFromItem(item) + '|';
    userToFilter = '|' + userFromItem(item) + '|';

    var buttonsBlock = $('#cboxLoadedContent .r-top-block');
    buttonsBlock.append('<hr style="width: 90%; margin-bottom: 1em;">');
    var div = $('<div class="cbox-img-ctrls"></div>').appendTo(buttonsBlock);
    div.append(entryBlockButton(entryToFilter));

    if (userToFilter != "||") {
        div.append(userBlockButton(userToFilter));
    }
}
