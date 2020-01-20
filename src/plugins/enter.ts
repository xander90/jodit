/*!
 * Jodit Editor (https://xdsoft.net/jodit/)
 * Licensed under GNU General Public License version 2 or later or a commercial license or MIT;
 * For GPL see LICENSE-GPL.txt in the project root for license information.
 * For MIT see LICENSE-MIT.txt in the project root for license information.
 * For commercial licenses see https://xdsoft.net/jodit/commercial/
 * Copyright (c) 2013-2020 Valeriy Chupurnov. All rights reserved. https://xdsoft.net
 */

import * as consts from '../constants';
import { Dom } from '../modules/Dom';
import { $$, scrollIntoView } from '../modules/helpers/';
import { HTMLTagNames, IJodit } from '../types';
import { Plugin } from '../modules/Plugin';

/**
 * Insert default paragraph
 *
 * @param {Jodit} editor
 * @param {Node} [fake]
 * @param {String} [wrapperTag]
 * @param {CSSStyleSheet} [style]
 * @return {HTMLElement}
 */
export const insertParagraph = (
	editor: IJodit,
	fake: Text | false,
	wrapperTag: HTMLTagNames,
	style?: CSSStyleDeclaration
): HTMLElement => {
	const p = editor.create.inside.element(wrapperTag),
		helper_node = editor.create.inside.element('br');

	p.appendChild(helper_node);

	if (style && style.cssText) {
		p.setAttribute('style', style.cssText);
	}

	editor.selection.insertNode(p, false, false);
	editor.selection.setCursorBefore(helper_node);

	const range = editor.selection.createRange();

	range.setStartBefore(wrapperTag.toLowerCase() !== 'br' ? helper_node : p);
	range.collapse(true);

	editor.selection.selectRange(range);

	Dom.safeRemove(fake);

	scrollIntoView(p, editor.editor, editor.editorDocument);

	editor.events?.fire('synchro'); // fire change

	return p;
};

/**
 * One of most important core plugins. It is responsible for all the browsers to have the same effect when the Enter
 * button is pressed. By default, it should insert the <p>
 */
export class enter extends Plugin {
	private brMode = false;
	private defaultTag: 'p' | 'br' | 'div' = consts.PARAGRAPH;

	private onEnter(event: KeyboardEvent): false | void {
		const editor = this.jodit,
			sel = editor.selection,
			defaultTag = this.defaultTag;

		let current = sel.current(false) as Node;

		let range = sel.range;

		if (!current || current === editor.editor) {
			current = this.createAndSelectInvisibleText(range);
		}

		let currentBox = this.getBlockWrapper(current);

		const isLi = currentBox && currentBox.nodeName === 'LI';

		// if use <br> defaultTag for break line or when was entered SHIFt key or in <td> or <th> or <blockquote>
		if (!isLi && this.checkBR(current, event.shiftKey) === false) {
			return false;
		}

		// wrap no wrapped element
		if (!currentBox && !this.hasPreviousBlock(current)) {
			currentBox = this.wrapText(current);
			range = sel.range;
		}

		if (!currentBox) {
			insertParagraph(editor, false, isLi ? 'li' : defaultTag);
			return false;
		}

		if (this.checkUnsplittableBox(currentBox) === false) {
			return false;
		}

		if (isLi && Dom.isEmpty(currentBox)) {
			this.enterInsideEmptyLIelement(currentBox);
			return false;
		}

		if (sel.cursorInTheEdge(true, currentBox)) {
			// if we are in the left edge of paragraph
			const fake = sel.setCursorBefore(currentBox);

			insertParagraph(
				editor,
				fake,
				isLi ? 'li' : defaultTag,
				currentBox.style
			);

			sel.setCursorIn(currentBox, true);

			return false;
		}

		if (sel.cursorInTheEdge(false, currentBox) === false) {
			// if we are not in right edge of paragraph
			// split p,h1 etc on two parts
			const leftRange = sel.createRange();

			leftRange.setStartBefore(currentBox);
			leftRange.setEnd(range.startContainer, range.startOffset);

			const fragment = leftRange.extractContents();

			if (currentBox.parentNode) {
				currentBox.parentNode.insertBefore(fragment, currentBox);
			}

			sel.setCursorIn(currentBox, true);
		} else {
			const fake = sel.setCursorAfter(currentBox);

			insertParagraph(
				editor,
				fake,
				isLi ? 'li' : defaultTag,
				currentBox.style
			);
		}
	}

	private createAndSelectInvisibleText(range: Range): Node {
		const sel = this.jodit.selection;

		sel.current();

		const current = this.jodit.create.inside.text(consts.INVISIBLE_SPACE);

		if (sel.sel?.rangeCount) {
			range.insertNode(current);
		} else {
			this.jodit.editor.appendChild(current);
		}

		range.selectNode(current);
		range.collapse(false);

		sel.selectRange(range);

		return current;
	}

	private getBlockWrapper(current: Node | null, tagReg = consts.IS_BLOCK): HTMLElement | false {
		let node = current;
		const root = this.jodit.editor;

		do {
			if (!node || node === root) {
				break;
			}

			if (tagReg.test(node.nodeName)) {
				if (node.nodeName === 'LI') {
					return node as HTMLLIElement;
				}

				return this.getBlockWrapper(node.parentNode, /^li$/i) || node as HTMLElement;
			}

			node = node.parentNode;
		} while (node && node !== root);

		return false;
	}

	private checkBR(current: Node, shiftKeyPressed: boolean): void | false {
		// if use <br> defaultTag for break line or when was entered SHIFt key or in <td> or <th> or <blockquote>
		if (
			this.brMode ||
			shiftKeyPressed ||
			Dom.closest(current, 'PRE|BLOCKQUOTE', this.jodit.editor)
		) {
			const br = this.jodit.create.inside.element('br');

			this.jodit.selection.insertNode(br, true);
			scrollIntoView(br, this.jodit.editor, this.jodit.editorDocument);

			return false;
		}
	}

	private wrapText(current: Node) {
		let needWrap: Node = current;

		Dom.up(
			needWrap,
			node => {
				if (
					node &&
					node.hasChildNodes() &&
					node !== this.jodit.editor
				) {
					needWrap = node;
				}
			},
			this.jodit.editor
		);

		const currentBox = Dom.wrapInline(
			needWrap,
			this.jodit.options.enter,
			this.jodit
		);

		if (Dom.isEmpty(currentBox)) {
			const helper_node = this.jodit.create.inside.element('br');

			currentBox.appendChild(helper_node);
			this.jodit.selection.setCursorBefore(helper_node);
		}

		return currentBox;
	}

	private hasPreviousBlock(current: Node): boolean {
		const editor = this.jodit;

		return Boolean(
			Dom.prev(
				current,
				(elm: Node | null) =>
					Dom.isBlock(elm, editor.editorWindow) ||
					Dom.isImage(elm, editor.editorWindow),
				editor.editor
			)
		);
	}

	private checkUnsplittableBox(currentBox: HTMLElement): false | void {
		const editor = this.jodit,
			sel = editor.selection;

		if (!Dom.canSplitBlock(currentBox, editor.editorWindow)) {
			const br = editor.create.inside.element('br');

			sel.insertNode(br, false);
			sel.setCursorAfter(br);

			return false;
		}
	}

	private enterInsideEmptyLIelement(currentBox: HTMLElement) {
		let fakeTextNode: Text | false = false;

		const ul: HTMLUListElement = Dom.closest(
			currentBox,
			'ol|ul',
			this.jodit.editor
		) as HTMLUListElement;

		// If there is no LI element before
		if (
			!Dom.prev(
				currentBox,
				(elm: Node | null) => elm && elm.nodeName === 'LI',
				ul
			)
		) {
			fakeTextNode = this.jodit.selection.setCursorBefore(ul);
			// If there is no LI element after
		} else if (
			!Dom.next(
				currentBox,
				(elm: Node | null) => elm && elm.nodeName === 'LI',
				ul
			)
		) {
			fakeTextNode = this.jodit.selection.setCursorAfter(ul);
		} else {
			const leftRange = this.jodit.selection.createRange();
			leftRange.setStartBefore(ul);
			leftRange.setEndAfter(currentBox);
			const fragment = leftRange.extractContents();

			if (ul.parentNode) {
				ul.parentNode.insertBefore(fragment, ul);
			}

			fakeTextNode = this.jodit.selection.setCursorBefore(ul);
		}

		Dom.safeRemove(currentBox);

		insertParagraph(this.jodit, fakeTextNode, this.defaultTag);

		if (!$$('li', ul).length) {
			Dom.safeRemove(ul);
		}
	}

	afterInit(editor: IJodit): void {
		// use 'enter' option if no set
		this.defaultTag = editor.options.enter.toLowerCase() as
			| 'p'
			| 'div'
			| 'br';
		this.brMode = this.defaultTag === consts.BR.toLowerCase();

		if (!editor.options.enterBlock) {
			editor.options.enterBlock = this.brMode
				? consts.PARAGRAPH
				: (this.defaultTag as 'p' | 'div');
		}

		editor.events
			.off('keydown.enter')
			.on('keydown.enter', (event: KeyboardEvent): false | void => {
				if (event.which === consts.KEY_ENTER) {
					/**
					 * Fired on processing `Enter` key. If return some value, plugin `enter` will do nothing.
					 * if return false - prevent default Enter behavior
					 *
					 * @event beforeEnter
					 */
					const beforeEnter = editor.events.fire(
						'beforeEnter',
						event
					);

					if (beforeEnter !== undefined) {
						return beforeEnter;
					}

					if (!editor.selection.isCollapsed()) {
						editor.execCommand('Delete');
					}

					editor.selection.focus();

					this.onEnter(event);

					return false;
				}
			});
	}

	beforeDestruct(editor: IJodit): void {
		editor.events.off('keydown.enter');
	}
}
