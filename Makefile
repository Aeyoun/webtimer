all: dist

extension = config.xml index.html options.html popup.html\
            background.js includes/*.js \
            icon_*.png \
            LICENSE

sysexcludes = '.DS_Store' '__MACOSX' \
              'Thumbs.db' 'desktop.ini'

webtimer.oex: $(extension)
	zip -9r ./webtimer.oex . -i $(extension) -x $(sysexcludes)

dist: webtimer.oex

clean:
	rm -f ./webtimer.oex
