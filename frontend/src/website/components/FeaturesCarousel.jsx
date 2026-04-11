import React from "react";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

import Slider from "react-slick";
import {
  PiArrowClockwise,
  PiArrowUpRight,
  PiBriefcase,
  PiCheckSquare,
  PiCode,
  PiColumns,
  PiFileText,
  PiFlame,
  PiHandPointing,
  PiImage,
  PiList,
  PiMicrophone,
  PiPen,
  PiPencil,
  PiSliders,
  PiUser,
  PiUsers,
} from "react-icons/pi";

const FeaturesCarousel = () => {
    const features = [
        {
          icon: <PiBriefcase size={48} color="#FFFFFF" />,
          title: "File Deck",
          description:
            "Use File Deck to find all the files of this collaboration platform in one place. Also, upload your local files to have anytime access.",
        },
        {
          icon: <PiArrowClockwise size={48} color="#FFFFFF" />,
          title: "Recall",
          description:
            "Did you mistakenly send the wrong message? You can recall it from both sides within ten minutes here in this instant messaging app.",
        },
        {
          icon: <PiList size={48} color="#FFFFFF" />,
          title: "Quick Response Panel",
          description:
            "It stores text files, images, videos, code snippets, URLs, and canned messages! Pick from the QRP and share it across groups or users.",
        },
        {
          icon: <PiColumns size={48} color="#FFFFFF" />,
          title: "Layout",
          description:
            "Play around with your chat area! Drag and drop the chat member list to have a broader chat area.",
        },
        {
          icon: <PiPencil size={48} color="#FFFFFF" />,
          title: "Message Edit",
          description:
            "Want to make corrections to the delivered chat message? Yes, you can do it with TeamChatX! Wondering how? Check it out!",
        },
        {
          icon: <PiMicrophone size={48} color="#FFFFFF" />,
          title: "Audio Messaging",
          description:
            "Don’t have time to type a message? No worries! Send an instant and crisp voice message to your co-worker. Available across all platforms.",
        },
        {
          icon: <PiHandPointing size={48} color="#FFFFFF" />,
          title: "Join Now",
          description:
            "Did you miss joining a group call? However, you can still join an ongoing call with Join Now from TeamChatX!",
        },
        {
          icon: <PiFileText size={48} color="#FFFFFF" />,
          title: "Attachment Preview",
          description:
            "Word Doc, Excel, PPTs, PDFs, Images, Videos, and other types of attachments, view them directly on the UI of TeamChatX.",
        },
        {
          icon: <PiUsers size={48} color="#FFFFFF" />,
          title: "Airtime Groups",
          description:
            "Want to broadcast announcements to a group of users, but you do not want to receive any responses from the members? Start using Airtime groups.",
        },
        {
          icon: <PiFlame size={48} color="#FFFFFF" />,
          title: "Burnout",
          description:
            "Exchange your confidential information in a self-destructible private chat window that doesn’t leave any chat backup.",
        },
        {
          icon: <PiArrowUpRight size={48} color="#FFFFFF" />,
          title: "Forkout",
          description:
            "You can send a message or an attachment to many users and groups in just one go using Forkout.",
        },
        {
          icon: <PiCheckSquare size={48} color="#FFFFFF" />,
          title: "Read Receipts",
          description:
            "Tag read receipt while sending a message and find out whether the recipient has read it or not!",
        },
        {
          icon: <PiUser size={48} color="#FFFFFF" />,
          title: "Orange Member",
          description:
            "It helps you invite your customers, stakeholders, non-employees, etc., to TeamChatX as guest users.",
        },
        {
          icon: <PiCode size={48} color="#FFFFFF" />,
          title: "Jointly Code",
          description:
            "Developers, you have an exclusive code editor in this collaboration tool. Meet in an audio-video conference call to write and edit code.",
        },
        {
          icon: <PiPen size={48} color="#FFFFFF" />,
          title: "Self Message",
          description:
            "Use this window to write something for yourself; it could be a back-up, research material, etc. It's handier than a note-taking app.",
        },
        {
          icon: <PiSliders size={48} color="#FFFFFF" />,
          title: "Chat Area Filters",
          description:
            "In this work chat app, you can filter text files, images, videos, and others, each separately from the chat area.",
        },
        {
          icon: <PiImage size={48} color="#FFFFFF" />,
          title: "Wallpaper",
          description:
            "Make your chat background more interesting with a wide range of wallpapers available within this team chat software.",
        },
      ];
      

  const settings = {
    centerMode: features.length >= 3, // Enable center mode only if there are 3 or more cards
    dots: true,
    autoplay: true,
    autoplaySpeed: 2000,
    infinite: true,
    speed: 500,
    slidesToShow: Math.min(features.length, 3), // Dynamically adjust visible slides
    arrows: false,
    slidesToScroll: 1,
    
    responsive: [
      {
        breakpoint: 1400,
        settings: {
          slidesToShow: Math.min(features.length, 3),
        },
      },
      {
        breakpoint: 991,
        settings: {
          slidesToShow: Math.min(features.length, 2),
        },
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: Math.min(features.length, 1),
        },
      },
      {
        breakpoint: 576,
        settings: {
          slidesToShow: 1,
          centerMode: false, // Disable center mode on small screens
          dots: false,
        },
      },
    ],
  };

  return (
    <section
      className="features-carousel my-5"
      style={{ background: "#737888", padding: "50px 20px" }}
    >
      <div className="container wrapper">
        <h2 className="text-center text-white">Unique Productive Features</h2>
        <p className="text-center text-light mb-5">
          Work conversations happen faster and better with this unified Business
          Collaboration Platform!
        </p>
        <Slider {...settings}>
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="carousel-card p-4">
                <div className="icon mb-1">{feature.icon}</div>
                <div>
                  <span>
                    <p className="title">{feature.title}</p>
                    <p
                      className="my-2"
                      style={{ fontSize: "14px", color: "#fff" }}
                    >
                      {feature.description}
                    </p>
                  </span>
                  <a href="#!" className="fs-6 text-light">
                    View more
                  </a>
                </div>
              </div>
            </div>
          ))}
        </Slider>
      </div>
    </section>
  );
};

export default FeaturesCarousel;
