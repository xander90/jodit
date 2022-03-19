/*!
 * Jodit Editor (https://xdsoft.net/jodit/)
 * Released under MIT see LICENSE.txt in the project root for license information.
 * Copyright (c) 2013-2022 Valeriy Chupurnov. All rights reserved. https://xdsoft.net
 */

/**
 * [[include:core/decorators/debounce/README.md]]
 * @packageDocumentation
 * @module decorators/debounce
 */

import type {
	IDictionary,
	IViewBased,
	IViewComponent,
	IAsyncParams,
	DecoratorHandler
} from 'jodit/types';
import {
	isFunction,
	isNumber,
	isPlainObject,
	isViewObject
} from 'jodit/core/helpers/checker';
import { Component, STATUSES } from 'jodit/core/component';
import { error } from 'jodit/core/helpers/utils/error';

export function debounce<V = IViewComponent | IViewBased>(
	timeout?: number | ((ctx: V) => number | IAsyncParams) | IAsyncParams,
	firstCallImmediately: boolean = false,
	method: 'debounce' | 'throttle' = 'debounce'
): DecoratorHandler {
	return <T extends Component & IDictionary>(
		target: IDictionary,
		propertyKey: string
	): PropertyDescriptor => {
		const fn = target[propertyKey];
		if (!isFunction(fn)) {
			throw error('Handler must be a Function');
		}

		target.hookStatus(STATUSES.ready, (component: V) => {
			const view = isViewObject(component)
				? component
				: (component as unknown as IViewComponent).jodit;

			const realTimeout = isFunction(timeout)
				? timeout(component)
				: timeout;

			Object.defineProperty(component, propertyKey, {
				configurable: true,
				value: view.async[method](
					(component as any)[propertyKey].bind(component),
					isNumber(realTimeout) || isPlainObject(realTimeout)
						? realTimeout
						: view.defaultTimeout,
					firstCallImmediately
				)
			});
		});

		return {
			configurable: true,
			get(): typeof fn {
				return fn.bind(this);
			}
		};
	};
}

/**
 * Wrap function in throttle wrapper
 */
export function throttle<V = IViewComponent | IViewBased>(
	timeout?: number | ((ctx: V) => number | IAsyncParams) | IAsyncParams,
	firstCallImmediately: boolean = false
): DecoratorHandler {
	return debounce<V>(timeout, firstCallImmediately, 'throttle');
}
