import React, { useEffect, useState } from 'react';
import { Debouncer } from '@lumino/polling';
import { CommandRegistry } from '@lumino/commands';
import { requestAPI } from './handler';
import { VDomModel, VDomRenderer } from '@jupyterlab/apputils';
import {
  wholeWordIcon,
  expandAllIcon,
  collapseAllIcon,
  replaceAllIcon,
  replaceIcon
} from './icon';
import {
  Search,
  TreeView,
  TreeItem,
  Badge,
  Progress,
  Button,
  TextField,
  Switch,
  Breadcrumb,
  BreadcrumbItem
} from '@jupyter-notebook/react-components';
import {
  caseSensitiveIcon,
  regexIcon,
  refreshIcon,
  folderIcon
} from '@jupyterlab/ui-components';
import { PathExt } from '@jupyterlab/coreutils';

export class SearchReplaceModel extends VDomModel {
  constructor() {
    super();
    this._isLoading = false;
    this._searchString = '';
    this._queryResults = [];
    this._caseSensitive = false;
    this._wholeWord = false;
    this._useRegex = false;
    this._filesFilter = '';
    this._excludeToggle = false;
    this._path = '';
    this._replaceString = '';
    this._debouncedStartSearch = new Debouncer(() => {
      this.getSearchString(
        this._searchString,
        this._caseSensitive,
        this._wholeWord,
        this._useRegex,
        this._filesFilter,
        this._excludeToggle,
        this._path
      );
    });
  }

  refreshResults(): void {
    this._debouncedStartSearch
      .invoke()
      .catch(reason => console.error(`failed query for due to ${reason}`));
  }

  get isLoading(): boolean {
    return this._isLoading;
  }

  set isLoading(v: boolean) {
    if (v !== this._isLoading) {
      this._isLoading = v;
      this.stateChanged.emit();
    }
  }

  get searchString(): string {
    return this._searchString;
  }

  set searchString(v: string) {
    if (v !== this._searchString) {
      this._searchString = v;
      this.stateChanged.emit();
      this.refreshResults();
    }
  }

  get caseSensitive(): boolean {
    return this._caseSensitive;
  }

  set caseSensitive(v: boolean) {
    if (v !== this._caseSensitive) {
      this._caseSensitive = v;
      this.stateChanged.emit();
      this.refreshResults();
    }
  }

  get wholeWord(): boolean {
    return this._wholeWord;
  }

  set wholeWord(v: boolean) {
    if (v !== this._wholeWord) {
      this._wholeWord = v;
      this.stateChanged.emit();
      this.refreshResults();
    }
  }

  get useRegex(): boolean {
    return this._useRegex;
  }

  set useRegex(v: boolean) {
    if (v !== this._useRegex) {
      this._useRegex = v;
      this.stateChanged.emit();
      this.refreshResults();
    }
  }

  get filesFilter(): string {
    return this._filesFilter;
  }

  set filesFilter(v: string) {
    if (v !== this._filesFilter) {
      this._filesFilter = v;
      this.stateChanged.emit();
      this.refreshResults();
    }
  }

  get excludeToggle(): boolean {
    return this._excludeToggle;
  }

  set excludeToggle(v: boolean) {
    if (v !== this._excludeToggle) {
      this._excludeToggle = v;
      this.stateChanged.emit();
      this.refreshResults();
    }
  }

  get queryResults(): IResults[] {
    return this._queryResults;
  }

  get path(): string {
    return this._path;
  }

  set path(v: string) {
    if (v !== this._path) {
      this._path = v;
      this.stateChanged.emit();
      this.refreshResults();
    }
  }

  get replaceString(): string {
    return this._replaceString;
  }

  set replaceString(v: string) {
    if (v !== this._replaceString) {
      this._replaceString = v;
      this.stateChanged.emit();
    }
  }

  private async getSearchString(
    search: string,
    caseSensitive: boolean,
    wholeWord: boolean,
    useRegex: boolean,
    includeFiles: string,
    excludeToggle: boolean,
    path: string
  ): Promise<void> {
    if (search === '') {
      this._queryResults = [];
      this.stateChanged.emit();
      return Promise.resolve();
    }
    try {
      this.isLoading = true;
      let excludeFiles = '';
      if (excludeToggle) {
        excludeFiles = includeFiles;
        includeFiles = '';
      }
      const data = await requestAPI<IQueryResult>(
        path +
          '?' +
          new URLSearchParams([
            ['query', search],
            ['case_sensitive', caseSensitive.toString()],
            ['whole_word', wholeWord.toString()],
            ['use_regex', useRegex.toString()],
            ['include', includeFiles],
            ['exclude', excludeFiles]
          ]).toString(),
        {
          method: 'GET'
        }
      );
      this._queryResults = data.matches;
      this.stateChanged.emit();
    } catch (reason) {
      console.error(
        `The jupyterlab_search_replace server extension appears to be missing.\n${reason}`
      );
    } finally {
      this.isLoading = false;
    }
  }

  async postReplaceString(results: IResults[]): Promise<void> {
    try {
      await requestAPI<void>(this.path, {
        method: 'POST',
        body: JSON.stringify({
          results,
          query: this.replaceString
        })
      });
    } catch (reason) {
      console.error(
        `The jupyterlab_search_replace server extension appears to be missing.\n${reason}`
      );
    } finally {
      this.refreshResults();
    }
  }

  private _isLoading: boolean;
  private _searchString: string;
  private _replaceString: string;
  private _caseSensitive: boolean;
  private _wholeWord: boolean;
  private _useRegex: boolean;
  private _filesFilter: string;
  private _excludeToggle: boolean;
  private _path: string;
  private _queryResults: IResults[];
  private _debouncedStartSearch: Debouncer;
}

interface IQueryResult {
  matches: IResults[];
}

/**
 * Interface to represent matches in a file
 * @interface IResults
 * @member path -- path of file
 * @member matches -- all matches within that file
 * @field line -- line containing the match
 * @field start -- starting offset of the match
 * @field end -- ending offset of the match
 * @field match -- the actual match itself
 * @field line_number -- the line number where the match occurs
 * @field absolute_offset -- the offset from the beginning of file
 */
interface IResults {
  path: string;
  matches: {
    line: string;
    start: number;
    end: number;
    match: string;
    line_number: number;
    absolute_offset: number;
  }[];
}

function openFile(prefixDir: string, path: string, _commands: CommandRegistry) {
  _commands.execute('docmanager:open', { path: PathExt.join(prefixDir, path) });
}

function createTreeView(
  results: IResults[],
  path: string,
  _commands: CommandRegistry,
  expandStatus: boolean[],
  setExpandStatus: (v: boolean[]) => void,
  onReplace: (r: IResults[]) => void
): JSX.Element {
  results.sort((a, b) => (a.path > b.path ? 1 : -1));
  const items = results.map((file, index) => {
    return (
      <TreeItem
        className="search-tree-files"
        expanded={expandStatus[index]}
        onClick={() => {
          const expandStatusNew = [...expandStatus];
          expandStatusNew[index] = !expandStatusNew[index];
          setExpandStatus(expandStatusNew);
        }}
      >
        <span title={file.path}>{file.path}</span>
        <Button
          title="button to replace a results from a particular file"
          onClick={() => {
            const partialResult: IResults[] = [
              {
                path: file.path,
                matches: file.matches
              }
            ];
            onReplace(partialResult);
          }}
        >
          <replaceAllIcon.react></replaceAllIcon.react>
        </Button>
        <Badge slot="end">{file.matches.length}</Badge>
        {file.matches.map(match => (
          <TreeItem
            className="search-tree-matches"
            onClick={(event: React.MouseEvent) => {
              openFile(path, file.path, _commands);
              event.stopPropagation();
            }}
          >
            <span title={match.line}>
              {match.line.slice(0, match.start)}
              <mark>{match.match}</mark>
              {match.line.slice(match.end)}
            </span>
            <Button
              title="button to replace a particular match"
              onClick={() => {
                const partialResult: IResults[] = [
                  {
                    path: file.path,
                    matches: [match]
                  }
                ];
                onReplace(partialResult);
              }}
            >
              <replaceIcon.react></replaceIcon.react>
            </Button>
          </TreeItem>
        ))}
      </TreeItem>
    );
  });

  if (items.length === 0) {
    return <p>No Matches Found</p>;
  } else {
    return (
      <div className="jp-search-replace-list">
        <TreeView>{items}</TreeView>
      </div>
    );
  }
}

//TODO: fix css issue with buttons
export class SearchReplaceView extends VDomRenderer<SearchReplaceModel> {
  private _commands: CommandRegistry;

  constructor(searchModel: SearchReplaceModel, commands: CommandRegistry) {
    super(searchModel);
    this._commands = commands;
    this.addClass('jp-search-replace-tab');
  }

  render(): JSX.Element | null {
    return (
      <SearchReplaceElement
        searchString={this.model.searchString}
        onSearchChanged={(s: string) => {
          this.model.searchString = s;
        }}
        excludeToggle={this.model.excludeToggle}
        onExcludeToggle={(v: boolean) => {
          this.model.excludeToggle = v;
        }}
        replaceString={this.model.replaceString}
        onReplaceString={(s: string) => {
          this.model.replaceString = s;
        }}
        onReplace={(r: IResults[]) => {
          this.model.postReplaceString(r);
        }}
        fileFilter={this.model.filesFilter}
        onFileFilter={(s: string) => {
          this.model.filesFilter = s;
        }}
        commands={this._commands}
        isLoading={this.model.isLoading}
        queryResults={this.model.queryResults}
        refreshResults={() => {
          this.model.refreshResults();
        }}
        path={this.model.path}
        onPathChanged={(s: string) => {
          this.model.path = s;
        }}
      >
        <Button
          title="button to enable case sensitive mode"
          appearance={this.model.caseSensitive === true ? 'accent' : 'neutral'}
          onClick={() => {
            this.model.caseSensitive = !this.model.caseSensitive;
          }}
        >
          <caseSensitiveIcon.react></caseSensitiveIcon.react>
        </Button>
        <Button
          title="button to enable whole word mode"
          appearance={this.model.wholeWord === true ? 'accent' : 'neutral'}
          onClick={() => {
            this.model.wholeWord = !this.model.wholeWord;
          }}
        >
          <wholeWordIcon.react></wholeWordIcon.react>
        </Button>
        <Button
          title="button to enable use regex mode"
          appearance={this.model.useRegex === true ? 'accent' : 'neutral'}
          onClick={() => {
            this.model.useRegex = !this.model.useRegex;
          }}
        >
          <regexIcon.react></regexIcon.react>
        </Button>
      </SearchReplaceElement>
    );
  }
}

interface IProps {
  searchString: string;
  queryResults: IResults[];
  commands: CommandRegistry;
  isLoading: boolean;
  onSearchChanged: (s: string) => void;
  excludeToggle: boolean;
  onExcludeToggle: (v: boolean) => void;
  fileFilter: string;
  onFileFilter: (s: string) => void;
  replaceString: string;
  onReplaceString: (s: string) => void;
  onReplace: (r: IResults[]) => void;
  children: React.ReactNode;
  refreshResults: () => void;
  path: string;
  onPathChanged: (s: string) => void;
}

interface IBreadcrumbProps {
  path: string;
  onPathChanged: (s: string) => void;
}

const Breadcrumbs = (props: IBreadcrumbProps) => {
  const pathItems = props.path.split('/');
  return (
    <Breadcrumb>
      <BreadcrumbItem>
        <Button
          onClick={() => {
            props.onPathChanged('');
          }}
        >
          <folderIcon.react></folderIcon.react>
        </Button>
      </BreadcrumbItem>
      {props.path &&
        pathItems.map((item, index) => {
          return (
            <BreadcrumbItem>
              <Button
                appearance="lightweight"
                onClick={() => {
                  props.onPathChanged(pathItems.slice(0, index + 1).join('/'));
                }}
              >
                {item}
              </Button>
            </BreadcrumbItem>
          );
        })}
    </Breadcrumb>
  );
};

const SearchReplaceElement = (props: IProps) => {
  const [expandStatus, setExpandStatus] = useState(
    new Array(props.queryResults.length).fill(true)
  );

  useEffect(() => {
    setExpandStatus(new Array(props.queryResults.length).fill(true));
  }, [props.queryResults]);

  return (
    <>
      <div className="search-title-with-refresh">
        Search
        <Button
          title="button to refresh and reload results"
          onClick={() => {
            props.refreshResults();
          }}
        >
          <refreshIcon.react></refreshIcon.react>
        </Button>
        <Button
          title="button to expand and collapse all results"
          disabled={props.queryResults.length === 0}
          onClick={() => {
            const expandStatusNew = new Array(props.queryResults.length).fill(
              !expandStatus.some(elem => elem)
            );
            setExpandStatus(expandStatusNew);
          }}
        >
          {expandStatus.some(elem => elem) ? (
            <collapseAllIcon.react></collapseAllIcon.react>
          ) : (
            <expandAllIcon.react></expandAllIcon.react>
          )}
        </Button>
      </div>
      <div className="breadcrumb-folder-paths">
        <Breadcrumbs
          path={props.path}
          onPathChanged={props.onPathChanged}
        ></Breadcrumbs>
      </div>
      <div className="search-bar-with-options">
        <Search
          appearance="outline"
          placeholder="Search"
          aria-label="Search files for text"
          onInput={(event: any) => {
            props.onSearchChanged(event.target.value);
          }}
          value={props.searchString}
        />
        {props.children}
      </div>
      <div className="replace-bar-with-button">
        <TextField
          appearance="outline"
          placeholder="Replace"
          onInput={(event: any) => {
            props.onReplaceString(event.target.value);
          }}
          value={props.replaceString}
        >
          Replace
        </TextField>
        <Button
          title="button to replace all matches with query"
          onClick={() => {
            props.onReplace(props.queryResults);
          }}
        >
          <replaceAllIcon.react></replaceAllIcon.react>
        </Button>
      </div>
      <div>
        <TextField
          appearance="outline"
          placeholder="Files filter"
          onInput={(event: any) => {
            props.onFileFilter(event.target.value);
          }}
          value={props.fileFilter}
        >
          File filters
        </TextField>
        <Switch
          title="switch to toggle the file filter mode"
          onChange={(event: any) => {
            props.onExcludeToggle(event.target.checked);
          }}
          checked={props.excludeToggle}
        >
          <span slot="checked-message">Files to exclude</span>
          <span slot="unchecked-message">Files to include</span>
        </Switch>
      </div>
      {props.isLoading ? (
        <Progress />
      ) : (
        props.searchString &&
        createTreeView(
          props.queryResults,
          props.path,
          props.commands,
          expandStatus,
          setExpandStatus,
          props.onReplace
        )
      )}
    </>
  );
};
