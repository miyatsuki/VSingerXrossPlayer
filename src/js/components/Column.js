import React from "react";

export default class Column extends React.Component {
  render() {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{ textAlign: "center", fontSize: "10vw" }}
          onClick={this.props.rotateFunction.bind(this, -1)}
        >
          ▲
        </div>
        <img
          src={
            "https://i.ytimg.com/vi/" +
            this.props.video_id_list[0] +
            "/mqdefault.jpg"
          }
          style={{ width: "40vw" }}
        ></img>
        <img
          src={
            "https://i.ytimg.com/vi/" +
            this.props.video_id_list[1] +
            "/mqdefault.jpg"
          }
          style={{ width: "40vw" }}
        ></img>
        <img
          src={
            "https://i.ytimg.com/vi/" +
            this.props.video_id_list[2] +
            "/mqdefault.jpg"
          }
          style={{ width: "40vw" }}
        ></img>
        <div
          style={{ textAlign: "center", fontSize: "10vw" }}
          onClick={this.props.rotateFunction.bind(this, +1)}
        >
          ▼
        </div>
        <div></div>
        <div
          className="overflow-text"
          style={{ fontSize: "5vw", textAlign: "center", width: "40vw" }}
        >
          {this.props.selected}
        </div>
        <div
          style={{ fontSize: "5vw", textAlign: "center", width: "40vw" }}
          onClick={this.props.lockFunction.bind(this)}
        >
          <img
            src={this.props.lock_icon}
            style={{ textAlign: "center", width: "10vw" }}
          ></img>
        </div>
      </div>
    );
  }
}
