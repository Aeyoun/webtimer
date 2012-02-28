all: dist

extension = config.xml index.html options.html popup.html \
            scripts/*.js includes/*.js \
            icon_*.png ToolbarIcon.png ToolbarIcon-Win.png styles/*.css \
            COPYING

sysexcludes = '.DS_Store' '__MACOSX' \
              'Thumbs.db' 'desktop.ini'

webtimer.oex: $(extension)
	zip -9r ./webtimer.oex . -i $(extension) -x $(sysexcludes)

dist: webtimer.oex

clean:
	rm -f ./webtimer.oex
