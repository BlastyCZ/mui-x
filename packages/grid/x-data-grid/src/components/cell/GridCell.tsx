/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import * as React from 'react';
import PropTypes from 'prop-types';
import clsx from 'clsx';
import {
  unstable_useForkRef as useForkRef,
  unstable_composeClasses as composeClasses,
  unstable_ownerDocument as ownerDocument,
  unstable_capitalize as capitalize,
} from '@mui/utils';
import { getDataGridUtilityClass } from '../../constants/gridClasses';
import {
  GridCellEventLookup,
  GridEvents,
  GridCellMode,
  GridCellModes,
  GridRowId,
} from '../../models';
import { GridAlignment } from '../../models/colDef/gridColDef';
import { useGridApiContext } from '../../hooks/utils/useGridApiContext';
import { useGridRootProps } from '../../hooks/utils/useGridRootProps';
import { gridFocusCellSelector } from '../../hooks/features/focus/gridFocusStateSelector';
import type { DataGridProcessedProps } from '../../models/props/DataGridProps';
import { FocusElement } from '../../models/params/gridCellParams';

export interface GridCellProps<V = any, F = V> {
  align: GridAlignment;
  className?: string;
  colIndex: number;
  field: string;
  rowId: GridRowId;
  formattedValue?: F;
  hasFocus?: boolean;
  height: number | 'auto';
  isEditable?: boolean;
  isSelected?: boolean;
  showRightBorder?: boolean;
  value?: V;
  width: number;
  cellMode?: GridCellMode;
  children: React.ReactNode;
  tabIndex: 0 | -1;
  colSpan?: number;
  disableDragEvents?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
  onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
  onMouseUp?: React.MouseEventHandler<HTMLDivElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  onDragEnter?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  [x: string]: any;
}

// Based on https://stackoverflow.com/a/59518678
let cachedSupportsPreventScroll: boolean;
function doesSupportPreventScroll(): boolean {
  if (cachedSupportsPreventScroll === undefined) {
    document.createElement('div').focus({
      get preventScroll() {
        cachedSupportsPreventScroll = true;
        return false;
      },
    });
  }
  return cachedSupportsPreventScroll;
}

type OwnerState = Pick<GridCellProps, 'align' | 'showRightBorder' | 'isEditable' | 'isSelected'> & {
  classes?: DataGridProcessedProps['classes'];
};

const useUtilityClasses = (ownerState: OwnerState) => {
  const { align, showRightBorder, isEditable, isSelected, classes } = ownerState;

  const slots = {
    root: [
      'cell',
      `cell--text${capitalize(align)}`,
      isEditable && 'cell--editable',
      isSelected && 'selected',
      showRightBorder && 'cell--withRightBorder',
      'withBorderColor',
    ],
    content: ['cellContent'],
  };

  return composeClasses(slots, getDataGridUtilityClass, classes);
};

let warnedOnce = false;

const GridCell = React.forwardRef<HTMLDivElement, GridCellProps>((props, ref) => {
  const {
    align,
    children,
    colIndex,
    colDef,
    cellMode,
    field,
    formattedValue,
    hasFocus,
    height,
    isEditable,
    isSelected,
    rowId,
    tabIndex,
    value,
    width,
    className,
    showRightBorder,
    extendRowFullWidth,
    row,
    colSpan,
    disableDragEvents,
    onClick,
    onDoubleClick,
    onMouseDown,
    onMouseUp,
    onMouseOver,
    onKeyDown,
    onKeyUp,
    onDragEnter,
    onDragOver,
    ...other
  } = props;

  const valueToRender = formattedValue == null ? value : formattedValue;
  const cellRef = React.useRef<HTMLDivElement>(null);
  const handleRef = useForkRef(ref, cellRef);
  const focusElementRef = React.useRef<FocusElement>(null);
  const apiRef = useGridApiContext();

  const rootProps = useGridRootProps();
  const ownerState = { align, showRightBorder, isEditable, classes: rootProps.classes, isSelected };
  const classes = useUtilityClasses(ownerState);

  const publishMouseUp = React.useCallback(
    (eventName: GridEvents) => (event: React.MouseEvent<HTMLDivElement>) => {
      const params = apiRef.current.getCellParams(rowId, field || '');
      apiRef.current.publishEvent(eventName as any, params as any, event);

      if (onMouseUp) {
        onMouseUp(event);
      }
    },
    [apiRef, field, onMouseUp, rowId],
  );

  const publishMouseDown = React.useCallback(
    (eventName: GridEvents) => (event: React.MouseEvent<HTMLDivElement>) => {
      const params = apiRef.current.getCellParams(rowId, field || '');
      apiRef.current.publishEvent(eventName as any, params as any, event);

      if (onMouseDown) {
        onMouseDown(event);
      }
    },
    [apiRef, field, onMouseDown, rowId],
  );

  const publish = React.useCallback(
    (eventName: keyof GridCellEventLookup, propHandler: any) =>
      (event: React.SyntheticEvent<HTMLDivElement>) => {
        // The row might have been deleted during the click
        if (!apiRef.current.getRow(rowId)) {
          return;
        }

        const params = apiRef.current.getCellParams(rowId!, field || '');
        apiRef.current.publishEvent(eventName, params, event as any);

        if (propHandler) {
          propHandler(event);
        }
      },
    [apiRef, field, rowId],
  );

  const style = {
    minWidth: width,
    maxWidth: width,
    minHeight: height,
    maxHeight: height === 'auto' ? 'none' : height, // max-height doesn't support "auto"
  };

  React.useEffect(() => {
    if (!hasFocus || cellMode === GridCellModes.Edit) {
      return;
    }

    const doc = ownerDocument(apiRef.current.rootElementRef!.current)!;

    if (cellRef.current && !cellRef.current.contains(doc.activeElement!)) {
      const focusableElement = cellRef.current!.querySelector<HTMLElement>('[tabindex="0"]');
      const elementToFocus = focusElementRef.current || focusableElement || cellRef.current;

      if (doesSupportPreventScroll()) {
        elementToFocus.focus({ preventScroll: true });
      } else {
        const scrollPosition = apiRef.current.getScrollPosition();
        elementToFocus.focus();
        apiRef.current.scroll(scrollPosition);
      }
    }
  }, [hasFocus, cellMode, apiRef]);

  let handleFocus: any = other.onFocus;

  if (
    process.env.NODE_ENV === 'test' &&
    rootProps.experimentalFeatures?.warnIfFocusStateIsNotSynced
  ) {
    handleFocus = (event: React.FocusEvent) => {
      const focusedCell = gridFocusCellSelector(apiRef);
      if (focusedCell?.id === rowId && focusedCell.field === field) {
        if (typeof other.onFocus === 'function') {
          other.onFocus(event);
        }
        return;
      }

      if (!warnedOnce) {
        console.warn(
          [
            `MUI: The cell with id=${rowId} and field=${field} received focus.`,
            `According to the state, the focus should be at id=${focusedCell?.id}, field=${focusedCell?.field}.`,
            "Not syncing the state may cause unwanted behaviors since the `cellFocusIn` event won't be fired.",
            'Call `fireEvent.mouseUp` before the `fireEvent.click` to sync the focus with the state.',
          ].join('\n'),
        );

        warnedOnce = true;
      }
    };
  }

  const column = apiRef.current.getColumn(field);
  const managesOwnFocus = column.type === 'actions';

  const renderChildren = () => {
    if (children === undefined) {
      const valueString = valueToRender?.toString();
      return (
        <div className={classes.content} title={valueString}>
          {valueString}
        </div>
      );
    }

    if (React.isValidElement(children) && managesOwnFocus) {
      return React.cloneElement<any>(children, { focusElementRef });
    }

    return children;
  };

  const draggableEventHandlers = disableDragEvents
    ? null
    : {
        onDragEnter: publish('cellDragEnter', onDragEnter),
        onDragOver: publish('cellDragOver', onDragOver),
      };

  return (
    <div
      ref={handleRef}
      className={clsx(className, classes.root)}
      role="cell"
      data-field={field}
      data-colindex={colIndex}
      aria-colindex={colIndex + 1}
      aria-colspan={colSpan}
      style={style}
      tabIndex={(cellMode === 'view' || !isEditable) && !managesOwnFocus ? tabIndex : -1}
      onClick={publish('cellClick', onClick)}
      onDoubleClick={publish('cellDoubleClick', onDoubleClick)}
      onMouseOver={publish('cellMouseOver', onMouseOver)}
      onMouseDown={publishMouseDown('cellMouseDown')}
      onMouseUp={publishMouseUp('cellMouseUp')}
      onKeyDown={publish('cellKeyDown', onKeyDown)}
      onKeyUp={publish('cellKeyUp', onKeyUp)}
      {...draggableEventHandlers}
      {...other}
      onFocus={handleFocus}
    >
      {renderChildren()}
    </div>
  );
});

const MemoizedCell = React.memo(GridCell);

GridCell.propTypes = {
  // ----------------------------- Warning --------------------------------
  // | These PropTypes are generated from the TypeScript type definitions |
  // | To update them edit the TypeScript types and run "yarn proptypes"  |
  // ----------------------------------------------------------------------
  align: PropTypes.oneOf(['center', 'left', 'right']),
  cellMode: PropTypes.oneOf(['edit', 'view']),
  children: PropTypes.node,
  className: PropTypes.string,
  colIndex: PropTypes.number,
  colSpan: PropTypes.number,
  disableDragEvents: PropTypes.bool,
  field: PropTypes.string,
  formattedValue: PropTypes.any,
  hasFocus: PropTypes.bool,
  height: PropTypes.oneOfType([PropTypes.oneOf(['auto']), PropTypes.number]),
  isEditable: PropTypes.bool,
  isSelected: PropTypes.bool,
  onClick: PropTypes.func,
  onDoubleClick: PropTypes.func,
  onDragEnter: PropTypes.func,
  onDragOver: PropTypes.func,
  onKeyDown: PropTypes.func,
  onMouseDown: PropTypes.func,
  onMouseUp: PropTypes.func,
  rowId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  showRightBorder: PropTypes.bool,
  tabIndex: PropTypes.oneOf([-1, 0]),
  value: PropTypes.any,
  width: PropTypes.number,
} as any;

export { MemoizedCell as GridCell };
