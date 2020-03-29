import React from "react";
import YouTube from "react-youtube";
import Header from "./Header";
import Footer from "./Footer";
import Column from "./Column";
const axios = require("axios").default;

export default class Layout extends React.Component {
  constructor() {
    super();
    this.state = {
      title: "VSinger Xross Player",
      selected_song: "月光",
      selected_singer: "レヴィ・エリファ",
      singer_song_map: "",
      song_singer_map: "",
      is_singer_locked: false,
      is_song_locked: false,
      is_searching: false,
      searching_vsinger: null,
      searching_song: null,
    };
  }

  componentDidMount() {
    axios
      .get(
        "https://vsinger-infos.s3-ap-northeast-1.amazonaws.com/video_id.json"
      )
      .then((res) => {
        const singer_song_map = res["data"];
        const song_singer_map = {};

        Object.keys(singer_song_map).forEach((singer) => {
          Object.keys(singer_song_map[singer]).forEach((song) => {
            if (!(song in song_singer_map)) {
              song_singer_map[song] = {};
            }
            song_singer_map[song][singer] = singer_song_map[singer][song];
          });
        });

        const vsinger_list = Object.keys(singer_song_map);
        const initial_vsinger_list_id = Math.floor(
          Math.random() * vsinger_list.length
        );
        const initial_vsinger = vsinger_list[initial_vsinger_list_id];

        const song_list = Object.keys(singer_song_map[initial_vsinger]);
        const initial_song_list_id = Math.floor(
          Math.random() * song_list.length
        );
        const initial_song = song_list[initial_song_list_id];

        this.setState({
          singer_song_map: singer_song_map,
          song_singer_map: song_singer_map,
          selected_singer: initial_vsinger,
          selected_song: initial_song,
        });
      });
  }

  roundMod(i, val) {
    return (i + val) % val;
  }

  changeTitle(title) {
    this.setState({ title });
  }

  rotate_singer(rotate_num, e) {
    const { selected_song, selected_singer, song_singer_map } = this.state;

    const singer_list = Object.keys(song_singer_map[selected_song]);
    const singer_list_id = singer_list.indexOf(selected_singer);
    const new_singer =
      singer_list[
        this.roundMod(singer_list_id + rotate_num, singer_list.length)
      ];
    this.setState({ selected_singer: new_singer });
  }

  rotate_song(rotate_num, e) {
    const { selected_song, selected_singer, singer_song_map } = this.state;

    const song_list = Object.keys(singer_song_map[selected_singer]);
    const song_list_id = song_list.indexOf(selected_song);
    const new_song =
      song_list[this.roundMod(song_list_id + rotate_num, song_list.length)];
    this.setState({ selected_song: new_song });
  }

  toggle_singer_lock() {
    this.setState({ is_singer_locked: !this.state.is_singer_locked });
  }

  toggle_song_lock() {
    this.setState({ is_song_locked: !this.state.is_song_locked });
  }

  openSearchModal(e) {
    this.setState({
      is_searching: true,
      searching_song: null,
      searching_vsinger: null,
    });
  }

  getCandidateVsinger() {
    if (this.state.searching_song === null) {
      return Object.keys(this.state.singer_song_map).sort();
    } else {
      return Object.keys(
        this.state.song_singer_map[this.state.searching_song]
      ).sort();
    }
  }

  getCandidateSong() {
    if (this.state.searching_vsinger === null) {
      return Object.keys(this.state.song_singer_map).sort();
    } else {
      return Object.keys(
        this.state.singer_song_map[this.state.searching_vsinger]
      ).sort();
    }
  }

  onVsingerSelected(e) {
    if (this.state.singer_song_map.hasOwnProperty(e.target.value)) {
      this.setState({ searching_vsinger: e.target.value });
    } else {
      this.setState({ searching_vsinger: null });
    }
  }

  onSongSelected(e) {
    if (this.state.song_singer_map.hasOwnProperty(e.target.value)) {
      this.setState({ searching_song: e.target.value });
    } else {
      this.setState({ searching_song: null });
    }
  }

  setSearchingResult() {
    if (
      (this.state.searching_song != null) &
      (this.state.searching_vsinger != null)
    ) {
      this.setState({
        selected_singer: this.state.searching_vsinger,
        selected_song: this.state.searching_song,
        is_searching: false,
      });
    } else if (this.state.searching_song == null) {
      const searching_song_list = Object.keys(
        this.state.singer_song_map[this.state.searching_vsinger]
      );
      const searching_song_list_id = Math.floor(
        Math.random() * searching_song_list.length
      );
      const searching_song = searching_song_list[searching_song_list_id];
      this.setState({
        selected_singer: this.state.searching_vsinger,
        selected_song: searching_song,
        is_searching: false,
      });
    } else if (this.state.searching_vsinger == null) {
      const searching_vsinger_list = Object.keys(
        this.state.song_singer_map[this.state.searching_song]
      );
      const searching_vsinger_list_id = Math.floor(
        Math.random() * searching_vsinger_list.length
      );
      const searching_vsinger =
        searching_vsinger_list[searching_vsinger_list_id];
      this.setState({
        selected_singer: searching_vsinger,
        selected_song: this.state.searching_song,
        is_searching: false,
      });
    }
  }

  closeSearchDialogue() {
    this.setState({ is_searching: false });
  }

  renderSearchDialogue() {
    if (this.state.is_searching) {
      return (
        <div className="modal">
          <div style={{ fontSize: "10vw" }}>VSinger</div>
          <input
            type="text"
            style={{ fontSize: "5vw", border: "solid" }}
            autoComplete="on"
            list="vsinger"
            onChange={this.onVsingerSelected.bind(this)}
          ></input>
          <datalist id="vsinger">
            {this.getCandidateVsinger().map((vsinger) => {
              return (
                <option value={vsinger} key={"singer_" + vsinger}></option>
              );
            })}
            }
          </datalist>
          <div style={{ fontSize: "10vw" }}>楽曲</div>
          <input
            type="text"
            style={{ fontSize: "5vw", border: "solid" }}
            autoComplete="on"
            list="song"
            onChange={this.onSongSelected.bind(this)}
          ></input>
          <datalist id="song">
            {this.getCandidateSong().map((song) => {
              return <option value={song} key={"song_" + song}></option>;
            })}
            }
          </datalist>
          <br />
          <button
            style={{ fontSize: "5vw", border: "solid" }}
            onClick={this.setSearchingResult.bind(this)}
          >
            設定
          </button>
          <button
            style={{ fontSize: "5vw", border: "solid" }}
            onClick={this.closeSearchDialogue.bind(this)}
          >
            キャンセル
          </button>
        </div>
      );
    }
  }

  render() {
    const {
      selected_song,
      selected_singer,
      singer_song_map,
      song_singer_map,
    } = this.state;
    const video_ratio = 9 / 16;
    const video_width = window.innerWidth * 0.9;
    const video_height = video_width * video_ratio;

    const opts = {
      height: video_height,
      width: video_width,
      playerVars: {
        autoplay: 0,
      },
    };

    if (singer_song_map == "") {
      return <div></div>;
    } else {
      const song_list = Object.keys(singer_song_map[selected_singer]);
      const song_list_id = song_list.indexOf(selected_song);
      const display_video_id_list_song = [-1, 0, 1].map(
        (val) =>
          song_singer_map[
            song_list[this.roundMod(song_list_id + val, song_list.length)]
          ][selected_singer]
      );

      const singer_list = Object.keys(song_singer_map[selected_song]);
      const singer_list_id = singer_list.indexOf(selected_singer);
      const display_video_id_list_singer = [-1, 0, 1].map(
        (val) =>
          singer_song_map[
            singer_list[this.roundMod(singer_list_id + val, singer_list.length)]
          ][selected_song]
      );

      const lock_icon_singer = this.state.is_singer_locked
        ? "img/lock-24px.svg"
        : "img/lock_open-24px.svg";
      const lock_icon_song = this.state.is_song_locked
        ? "img/lock-24px.svg"
        : "img/lock_open-24px.svg";

      return (
        <div style={{ width: "100%" }}>
          <Header
            changeTitle={this.changeTitle.bind(this)}
            title={this.state.title}
          />
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            <Column
              rotateFunction={this.rotate_singer.bind(this)}
              lockFunction={this.toggle_singer_lock.bind(this)}
              video_id_list={display_video_id_list_singer}
              selected={this.state.selected_singer}
              lock_icon={lock_icon_singer}
              openSearchModal={this.openSearchModal.bind(this)}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: "20vw",
              }}
            >
              X
            </div>
            <Column
              rotateFunction={this.rotate_song.bind(this)}
              lockFunction={this.toggle_song_lock.bind(this)}
              video_id_list={display_video_id_list_song}
              selected={this.state.selected_song}
              lock_icon={lock_icon_song}
              openSearchModal={this.openSearchModal.bind(this)}
            />
          </div>
          <div style={{ textAlign: "center" }}>
            <YouTube
              videoId={singer_song_map[selected_singer][selected_song]}
              opts={opts}
              onReady={this._onReady.bind(this)}
              onEnd={this._onEnd.bind(this)}
            />
          </div>
          <Footer />
          {this.renderSearchDialogue()}
        </div>
      );
    }
  }

  _onReady(event) {
    console.log(this);
    console.log(event);
    event.target.pauseVideo();
  }

  _onEnd(event) {
    console.log(this);
    console.log(event);

    const song_list = Object.keys(
      this.state.singer_song_map[this.state.selected_singer]
    );
    const singer_list = Object.keys(
      this.state.song_singer_map[this.state.selected_song]
    );
    const dice_roll = Math.random();

    if (this.state.is_singer_locked && this.state.is_song_locked) {
      console.log("singer & song locked");
      restart_video(event.target);
    } else if (!this.state.is_singer_locked && this.state.is_song_locked) {
      console.log("song locked");
      if (singer_list.length == 1) {
        restart_video(event.target);
      } else {
        this.rotate_singer(1, null);
      }
    } else if (this.state.is_singer_locked && !this.state.is_song_locked) {
      console.log("singer locked");
      if (song_list.length == 1) {
        restart_video(event.target);
      } else {
        this.rotate_song(1, null);
      }
    } else if (song_list.length == 1) {
      console.log("only 1 song");
      this.rotate_singer(1, null);
    } else if (singer_list.length == 1) {
      console.log("only 1 singer");
      this.rotate_song(1, null);
    } else if (dice_roll < 0.5) {
      console.log("dice roll " + dice_roll);
      this.rotate_song(1, null);
    } else {
      console.log("dice roll " + dice_roll);
      this.rotate_singer(1, null);
    }
  }

  restart_video(yt_target) {
    const video_sec = yt_target.getDuration();
    yt_target.seekTo(-video_sec, true);
  }
}
