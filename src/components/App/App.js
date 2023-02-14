import React from 'react';
import { Input, Tabs, Spin, Space, Modal } from 'antd';
import _debounce from 'lodash/debounce';
import { Offline, Online } from 'react-detect-offline';

import MovieService from '../../services/MovieService';
import FilmList from '../FilmList/FilmList';
import GenresContext from '../../services/GenresContext';
import ErrorIndicator from '../ErrorIndicator/ErrorIndicator';
import './App.css';

export default class App extends React.Component {
  movieService = new MovieService();
  searchFilmDebounce = _debounce(() => {
    const { searchFilm } = this.state;
    this.setState({
      fetchSearchFilm: searchFilm,
    });
  }, 1000);

  constructor(props) {
    super(props);
    this.state = {
      searchFilm: null,
      fetchSearchFilm: null,
      filmList: null,
      currentPage: 1,
      totalResults: null,
      loading: false,
      error: null,
      currentTab: 'search',
      guestSessionId: null,
      genresList: null,
      ratedFilms: new Map(),
    };
    this.textInput = React.createRef();
  }

  componentDidMount() {
    this.createGuestSession();
    this.getGenresList();
    this.getFilms();
    this.textInput.current.focus();
  }

  componentDidUpdate(prevProps, prevState) {
    const { currentTab, currentPage, fetchSearchFilm } = this.state;
    if (prevState.fetchSearchFilm !== fetchSearchFilm) {
      this.setState({
        currentPage: 1,
      });
      this.getFilms();
    }
    if (prevState.currentTab !== currentTab) {
      this.setState({
        currentPage: 1,
      });
      if (currentTab === 'search') {
        this.getFilms();
      } else {
        this.getRatedFilms();
      }
    }
    if (prevState.currentPage !== currentPage) {
      if (currentTab === 'search') {
        this.getFilms();
      } else {
        this.getRatedFilms();
      }
    }
  }

  onChangeSearch = (evt) => {
    this.setState({
      searchFilm: evt.target.value,
    });
    this.searchFilmDebounce();
  };

  onSubmitSearch = (evt) => {
    evt.preventDefault();
  };

  onChangePage = (page) => {
    this.setState({
      currentPage: page,
    });
  };

  onChangeTab = (tab) => {
    this.setState({
      currentTab: tab,
    });
  };

  onChangeRate = (rate, id) => {
    const { guestSessionId } = this.state;
    this.movieService
      .rateMovie(guestSessionId, id, rate)
      .then(() => {
        this.setState(({ ratedFilms }) => ({
          ratedFilms: new Map(ratedFilms.set(id, rate)),
        }));
        localStorage.setItem(id, rate);
      })
      .catch((err) => {
        this.onError(err);
      });
  };

  onError = (err) => {
    this.setState({
      error: err.message,
      loading: false,
    });
    console.log(err);
  };

  getFilmsList(serviceFunc) {
    console.log(serviceFunc);
    this.setState({
      loading: true,
    });
    try {
      serviceFunc()
        .then((listFilm) => {
          console.log(listFilm);
          this.setState({
            filmList: listFilm.results,
            totalResults: listFilm.total_results,
            loading: false,
          });
        })
        .catch((err) => {
          this.onError(err);
        });
    } catch (err) {
      this.onError(err);
    }
  }

  getFilms = () => {
    const { fetchSearchFilm, currentPage } = this.state;
    const { getSearch, getPopular } = this.movieService;
    if (fetchSearchFilm) {
      this.getFilmsList(() => getSearch(fetchSearchFilm, currentPage));
    } else {
      this.getFilmsList(() => getPopular(currentPage));
    }
  };

  getRatedFilms = () => {
    const { guestSessionId, currentPage } = this.state;
    const { getRated } = this.movieService;
    this.getFilmsList(() => getRated(guestSessionId, currentPage));
  };

  createGuestSession() {
    if (Date.parse(localStorage.getItem('expires_at')) < Date.now() || !localStorage.getItem('expires_at')) {
      try {
        this.movieService
          .createGuestSession()
          .then((result) => {
            this.setState({
              guestSessionId: result.guest_session_id,
            });
            localStorage.clear();
            localStorage.setItem('guest_session_id', result.guest_session_id);
            localStorage.setItem('expires_at', result.expires_at);
          })
          .catch((err) => {
            this.onError(err);
          });
      } catch (err) {
        this.onError(err);
      }
    } else {
      this.setState({
        guestSessionId: localStorage.getItem('guest_session_id'),
      });
    }
  }

  getGenresList() {
    this.movieService.getGenres().then(({ genres }) => {
      this.setState({
        genresList: genres,
      });
    });
  }

  render() {
    const {
      filmList,
      guestSessionId,
      genresList,
      searchFilm,
      fetchSearchFilm,
      totalResults,
      currentPage,
      ratedFilms,
      loading,
      error,
    } = this.state;
    const hasData = !(loading || error);
    const errorIndicator = error ? <ErrorIndicator text={error} /> : null;
    const spinner = loading ? (
      <Space size="middle">
        <Spin size="large" />
      </Space>
    ) : null;
    const content = hasData ? (
      <FilmList
        filmList={filmList}
        fetchSearchFilm={fetchSearchFilm}
        currentPage={currentPage}
        onChangePage={this.onChangePage}
        onChangeRate={this.onChangeRate}
        totalResults={totalResults}
        guestSessionId={guestSessionId}
        ratedFilms={ratedFilms}
      />
    ) : null;
    const tabs = [
      {
        label: 'Search',
        key: 'search',
        children: (
          <div className="wrapper">
            <form onSubmit={this.onSubmitSearch}>
              <Input
                placeholder="Type to search"
                value={searchFilm}
                onChange={this.onChangeSearch}
                ref={this.textInput}
              />
            </form>
            {errorIndicator}
            {spinner}
            {content}
          </div>
        ),
      },
      {
        label: 'Rated',
        key: 'rated',
        children: (
          <div className="wrapper">
            {errorIndicator}
            {spinner}
            {content}
          </div>
        ),
      },
    ];

    const networkError = (err) => {
      Modal.destroyAll();
      if (!err) {
        Modal.error({
          title: 'No internet connection',
          content: 'No internet connection',
        });
      } else {
        Modal.success({
          content: 'Successfull connection',
        });
      }
    };

    const polling = {
      enabled: true,
      url: 'www.themoviedb.org/',
    };

    return (
      <React.Fragment>
        <Online polling={polling}>
          <GenresContext.Provider value={genresList}>
            <div className="App">
              <Tabs items={tabs} centered onChange={this.onChangeTab} />
            </div>
          </GenresContext.Provider>
        </Online>
        <Offline polling={polling} onChange={networkError} />
      </React.Fragment>
    );
  }
}
